import { eq, and, sql } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { generatePrefixedId } from '@/lib/db/id';
import { modelRun, modelRunResult } from './model-run.schema';
import { listPrompts } from '@/modules/prompt-sets/prompt-set.service';
import { getBrand } from '@/modules/brands/brand.service';
import { interpolateTemplate } from '@/modules/prompt-sets/template';
import { getAdapterRegistry } from '@/modules/adapters';
import { platformAdapter } from '@/modules/adapters/adapter.schema';
import { decryptCredential } from '@/modules/adapters/adapter.crypto';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import {
  PermanentAdapterError,
  TransientAdapterError,
  RateLimitAdapterError,
} from '@/modules/adapters/adapter.types';
import type { EncryptedValue } from '@/modules/adapters/adapter.types';
import type { WebhookEventType } from '@/modules/webhooks/webhook.events';
import { logger } from '@/lib/logger';
import type pino from 'pino';
import { isNull } from 'drizzle-orm';

// -- Helpers ----------------------------------------------------------------

function hasCredentials(credentials: unknown): boolean {
  if (!credentials || typeof credentials !== 'object') return false;
  const obj = credentials as Record<string, unknown>;
  return 'ciphertext' in obj && 'iv' in obj && 'tag' in obj;
}

async function loadAdapterConfig(adapterConfigId: string) {
  const [record] = await db
    .select()
    .from(platformAdapter)
    .where(and(eq(platformAdapter.id, adapterConfigId), isNull(platformAdapter.deletedAt)))
    .limit(1);

  if (!record) return null;

  const decryptedCredentials = hasCredentials(record.credentials)
    ? JSON.parse(decryptCredential(record.credentials as EncryptedValue))
    : {};

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    platformId: record.platformId,
    displayName: record.displayName,
    enabled: record.enabled,
    credentials: decryptedCredentials,
    config: (record.config ?? {}) as Record<string, unknown>,
    rateLimitPoints: record.rateLimitPoints,
    rateLimitDuration: record.rateLimitDuration,
    timeoutMs: record.timeoutMs,
    maxRetries: record.maxRetries,
    circuitBreakerThreshold: record.circuitBreakerThreshold,
    circuitBreakerResetMs: record.circuitBreakerResetMs,
  };
}

// -- Coordinator ------------------------------------------------------------

export async function executeModelRun(
  runId: string,
  workspaceId: string,
  boss: PgBoss
): Promise<void> {
  const log = logger.child({ runId, workspaceId });

  // Load run and verify status
  const [run] = await db
    .select({
      id: modelRun.id,
      status: modelRun.status,
      promptSetId: modelRun.promptSetId,
      brandId: modelRun.brandId,
      adapterConfigIds: modelRun.adapterConfigIds,
      locale: modelRun.locale,
      market: modelRun.market,
    })
    .from(modelRun)
    .where(and(eq(modelRun.id, runId), eq(modelRun.workspaceId, workspaceId)))
    .limit(1);

  if (!run) {
    log.error('Model run not found');
    return;
  }

  if (run.status !== 'pending') {
    log.info({ status: run.status }, 'Model run is not pending, skipping');
    return;
  }

  // Set status to running
  await db
    .update(modelRun)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(modelRun.id, runId));

  try {
    // Load prompts
    const prompts = await listPrompts(run.promptSetId, workspaceId);
    if (!prompts || prompts.length === 0) {
      throw new Error('Prompt set not found or has no prompts');
    }

    // Load brand for interpolation
    const brandRecord = await getBrand(run.brandId, workspaceId);
    if (!brandRecord) {
      throw new Error('Brand not found or deleted');
    }

    // Build interpolation variables
    const variables: Record<string, string> = {
      brand: brandRecord.name,
    };
    if (run.locale) variables.locale = run.locale;
    if (run.market) variables.market = run.market;

    // Resolve adapter platformIds for result rows
    const adapterPlatformIds: Record<string, string> = {};
    for (const adapterConfigId of run.adapterConfigIds) {
      const config = await loadAdapterConfig(adapterConfigId);
      if (config) {
        adapterPlatformIds[adapterConfigId] = config.platformId;
      }
    }

    // Build result rows and worker jobs
    const resultRows: {
      id: string;
      modelRunId: string;
      promptId: string;
      adapterConfigId: string;
      platformId: string;
      interpolatedPrompt: string;
    }[] = [];

    for (const promptRecord of prompts) {
      const interpolatedPrompt = interpolateTemplate(promptRecord.template, variables);

      for (const adapterConfigId of run.adapterConfigIds) {
        const platformId = adapterPlatformIds[adapterConfigId] ?? 'unknown';
        resultRows.push({
          id: generatePrefixedId('modelRunResult'),
          modelRunId: runId,
          promptId: promptRecord.id,
          adapterConfigId,
          platformId,
          interpolatedPrompt,
        });
      }
    }

    // Insert all result rows
    if (resultRows.length > 0) {
      await db.insert(modelRunResult).values(resultRows);
    }

    // Batch-insert worker jobs
    const workerJobs = resultRows.map((row) => ({
      data: {
        resultId: row.id,
        runId,
        workspaceId,
        promptId: row.promptId,
        adapterConfigId: row.adapterConfigId,
        interpolatedPrompt: row.interpolatedPrompt,
        locale: run.locale,
      },
      retryLimit: 3,
      retryDelay: 10,
      retryBackoff: true,
      expireInSeconds: 600,
    }));

    await boss.insert('model-run-query', workerJobs);

    log.info({ resultCount: resultRows.length }, 'Model run coordinator dispatched worker jobs');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    log.error({ error: errorMessage }, 'Model run coordinator failed');

    await db
      .update(modelRun)
      .set({
        status: 'failed',
        errorSummary: errorMessage,
        completedAt: new Date(),
      })
      .where(eq(modelRun.id, runId));
  }
}

// -- Worker -----------------------------------------------------------------

export async function executeModelRunQuery(
  resultId: string,
  runId: string,
  workspaceId: string,
  promptId: string,
  adapterConfigId: string,
  interpolatedPrompt: string,
  locale: string | null,
  boss?: PgBoss
): Promise<void> {
  const log = logger.child({ resultId, runId, adapterConfigId });

  // Idempotency: check result status
  const [result] = await db
    .select({ status: modelRunResult.status })
    .from(modelRunResult)
    .where(eq(modelRunResult.id, resultId))
    .limit(1);

  if (!result || result.status !== 'pending') {
    log.info({ status: result?.status }, 'Result not pending, skipping');
    return;
  }

  // Cancellation check
  const [run] = await db
    .select({ status: modelRun.status })
    .from(modelRun)
    .where(eq(modelRun.id, runId))
    .limit(1);

  if (run?.status === 'cancelled') {
    await db
      .update(modelRunResult)
      .set({ status: 'skipped', completedAt: new Date() })
      .where(eq(modelRunResult.id, resultId));

    await decrementPendingResults(runId, workspaceId, log, boss);
    return;
  }

  // Set result to running
  await db
    .update(modelRunResult)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(modelRunResult.id, resultId));

  try {
    // Load adapter config with credentials
    const config = await loadAdapterConfig(adapterConfigId);
    if (!config) {
      throw new PermanentAdapterError('Adapter configuration not found', adapterConfigId);
    }

    // Create adapter instance and query
    const registry = getAdapterRegistry();
    const adapter = registry.createInstance(config.platformId, config);

    const response = await adapter.query(interpolatedPrompt, {
      locale: locale ?? undefined,
      idempotencyKey: resultId,
    });

    // Store successful result
    await db
      .update(modelRunResult)
      .set({
        status: 'completed',
        rawResponse: response.rawResponse,
        textContent: response.textContent,
        responseMetadata: response.metadata as unknown as Record<string, unknown>,
        completedAt: new Date(),
      })
      .where(eq(modelRunResult.id, resultId));

    await decrementPendingResults(runId, workspaceId, log, boss);
  } catch (err) {
    if (err instanceof PermanentAdapterError) {
      // Permanent failure — store and don't retry
      await db
        .update(modelRunResult)
        .set({
          status: 'failed',
          error: err.message,
          completedAt: new Date(),
        })
        .where(eq(modelRunResult.id, resultId));

      await decrementPendingResults(runId, workspaceId, log, boss);
      return;
    }

    if (err instanceof TransientAdapterError || err instanceof RateLimitAdapterError) {
      // Transient failure — throw to trigger pg-boss retry
      log.warn({ error: err.message }, 'Transient adapter error, retrying');
      throw err;
    }

    // Unknown error — treat as permanent failure
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await db
      .update(modelRunResult)
      .set({
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(eq(modelRunResult.id, resultId));

    await decrementPendingResults(runId, workspaceId, log, boss);
  }
}

// -- Fan-in -----------------------------------------------------------------

async function decrementPendingResults(
  runId: string,
  workspaceId: string,
  log: pino.Logger,
  boss?: PgBoss
): Promise<void> {
  const [updated] = await db
    .update(modelRun)
    .set({
      pendingResults: sql`${modelRun.pendingResults} - 1`,
    })
    .where(eq(modelRun.id, runId))
    .returning({ pendingResults: modelRun.pendingResults });

  if (updated && updated.pendingResults <= 0) {
    log.info('All results complete, finalizing model run');
    await finalizeModelRun(runId, workspaceId, boss);
  }
}

// -- Finalization -----------------------------------------------------------

export async function finalizeModelRun(
  runId: string,
  workspaceId: string,
  boss?: PgBoss
): Promise<void> {
  const log = logger.child({ runId });

  // Count results by status
  const resultCounts = await db
    .select({
      status: modelRunResult.status,
      count: sql<number>`count(*)::int`,
    })
    .from(modelRunResult)
    .where(eq(modelRunResult.modelRunId, runId))
    .groupBy(modelRunResult.status);

  const counts: Record<string, number> = {};
  for (const row of resultCounts) {
    counts[row.status] = row.count;
  }

  const completed = counts['completed'] ?? 0;
  const failed = counts['failed'] ?? 0;
  const skipped = counts['skipped'] ?? 0;
  const total = completed + failed + skipped + (counts['pending'] ?? 0) + (counts['running'] ?? 0);

  // Determine final status
  let finalStatus: 'completed' | 'partial' | 'failed';
  let webhookEvent: WebhookEventType;

  if (
    completed > 0 &&
    failed === 0 &&
    (counts['pending'] ?? 0) === 0 &&
    (counts['running'] ?? 0) === 0
  ) {
    finalStatus = 'completed';
    webhookEvent = 'model_run.completed';
  } else if (completed === 0 && failed > 0) {
    finalStatus = 'failed';
    webhookEvent = 'model_run.failed';
  } else {
    finalStatus = 'partial';
    webhookEvent = 'model_run.partial';
  }

  // Build error summary if there are failures
  let errorSummary: string | null = null;
  if (failed > 0) {
    errorSummary = `${failed} of ${total} queries failed`;
  }

  const now = new Date();
  await db
    .update(modelRun)
    .set({
      status: finalStatus,
      errorSummary,
      completedAt: now,
      pendingResults: 0,
    })
    .where(eq(modelRun.id, runId));

  log.info({ finalStatus, completed, failed, skipped }, 'Model run finalized');

  // Dispatch webhook
  if (boss) {
    const [run] = await db
      .select({
        id: modelRun.id,
        promptSetId: modelRun.promptSetId,
        brandId: modelRun.brandId,
        adapterConfigIds: modelRun.adapterConfigIds,
        locale: modelRun.locale,
        totalResults: modelRun.totalResults,
        startedAt: modelRun.startedAt,
        completedAt: modelRun.completedAt,
      })
      .from(modelRun)
      .where(eq(modelRun.id, runId))
      .limit(1);

    if (run) {
      const duration =
        run.startedAt && run.completedAt
          ? run.completedAt.getTime() - run.startedAt.getTime()
          : null;

      await dispatchWebhookEvent(
        workspaceId,
        webhookEvent,
        {
          modelRun: {
            id: run.id,
            status: finalStatus,
            promptSetId: run.promptSetId,
            brandId: run.brandId,
            platforms: run.adapterConfigIds,
            locale: run.locale,
            totalResults: run.totalResults,
            completedResults: completed,
            failedResults: failed,
            skippedResults: skipped,
            ...(errorSummary && { errorSummary }),
            ...(duration !== null && { duration }),
            startedAt: run.startedAt?.toISOString() ?? null,
            completedAt: run.completedAt?.toISOString() ?? null,
          },
        },
        boss
      );
    }

    // Enqueue citation extraction for completed or partial runs
    if (finalStatus === 'completed' || finalStatus === 'partial') {
      await boss.send(
        'citation-extract',
        { runId, workspaceId },
        {
          retryLimit: 3,
          retryDelay: 10,
          retryBackoff: true,
          singletonKey: `citation-extract-${runId}`,
        }
      );

      log.info('Enqueued citation extraction job');
    }
  }
}

// -- Stale run monitor ------------------------------------------------------

export async function checkStaleRuns(boss: PgBoss): Promise<void> {
  const log = logger.child({ job: 'model-run-stale-check' });

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Find runs stuck in 'running' with startedAt older than 15 minutes
  const staleRuns = await db
    .select({
      id: modelRun.id,
      workspaceId: modelRun.workspaceId,
    })
    .from(modelRun)
    .where(and(eq(modelRun.status, 'running'), sql`${modelRun.startedAt} < ${fifteenMinutesAgo}`));

  for (const run of staleRuns) {
    log.warn({ runId: run.id }, 'Detected stale model run, forcing finalization');

    // Mark any pending/running results as failed
    await db
      .update(modelRunResult)
      .set({
        status: 'failed',
        error: 'Worker job expired',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(modelRunResult.modelRunId, run.id),
          sql`${modelRunResult.status} IN ('pending', 'running')`
        )
      );

    await finalizeModelRun(run.id, run.workspaceId, boss);
  }

  if (staleRuns.length > 0) {
    log.info({ count: staleRuns.length }, 'Finalized stale model runs');
  }
}
