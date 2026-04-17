import type { PgBoss } from 'pg-boss';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { modelRun, modelRunResult } from '@/modules/model-runs/model-run.schema';
import { getBrand } from '@/modules/brands/brand.service';
import { getAdapterRegistry } from '@/modules/adapters';
import { platformAdapter } from '@/modules/adapters/adapter.schema';
import { decryptCredential } from '@/modules/adapters/adapter.crypto';
import type {
  AdapterConfig,
  EncryptedValue,
  PlatformAdapter,
  PlatformResponse,
} from '@/modules/adapters/adapter.types';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { citation } from './citation.schema';
import { generatePrefixedId } from '@/lib/db/id';
import { classifyCitationType, filterBrandRelevantCitations } from './citation.classifier';
import { analyzeSentiment } from './sentiment';
import { normalizeUrl } from './url-normalize';
import { runQueryFanoutForResult } from '@/modules/query-fanout/query-fanout.service';

/**
 * Extract, classify, and persist citations for a completed model run.
 *
 * Called by the citation-extract pg-boss handler after model run finalization.
 * Idempotent: re-running for the same run produces no duplicates thanks to the
 * unique index on (modelRunResultId, sourceUrl) with onConflictDoNothing.
 */
export async function extractCitationsForModelRun(
  runId: string,
  workspaceId: string,
  boss: PgBoss
): Promise<void> {
  const log = logger.child({ runId, workspaceId });

  // 1. Load the model run to get brandId
  const [run] = await db
    .select({
      brandId: modelRun.brandId,
      locale: modelRun.locale,
      promptSetId: modelRun.promptSetId,
      startedAt: modelRun.startedAt,
    })
    .from(modelRun)
    .where(eq(modelRun.id, runId))
    .limit(1);

  if (!run) {
    log.error('Model run not found for citation extraction');
    throw new Error(`Model run ${runId} not found`);
  }

  // 2. Load brand (name, aliases, domain)
  const brandRecord = await getBrand(run.brandId, workspaceId);
  if (!brandRecord) {
    log.warn(
      { brandId: run.brandId },
      'Brand not found (may be soft-deleted), skipping extraction'
    );
    return;
  }

  const brand = {
    name: brandRecord.name,
    aliases: (brandRecord.aliases ?? []) as string[],
    domain: brandRecord.domain,
  };

  // 3. Load all completed results for this run
  const results = await db
    .select({
      id: modelRunResult.id,
      platformId: modelRunResult.platformId,
      adapterConfigId: modelRunResult.adapterConfigId,
      rawResponse: modelRunResult.rawResponse,
      textContent: modelRunResult.textContent,
      responseMetadata: modelRunResult.responseMetadata,
      interpolatedPrompt: modelRunResult.interpolatedPrompt,
      promptId: modelRunResult.promptId,
    })
    .from(modelRunResult)
    .where(and(eq(modelRunResult.modelRunId, runId), eq(modelRunResult.status, 'completed')));

  if (results.length === 0) {
    log.info('No completed results to extract citations from');
    return;
  }

  // 4. Process each result — cache adapter instances by adapterConfigId
  const adapterCache = new Map<string, PlatformAdapter>();
  const registry = getAdapterRegistry();
  const allInsertRows: (typeof citation.$inferInsert)[] = [];

  for (const result of results) {
    try {
      // Get or create adapter instance
      let adapter = adapterCache.get(result.adapterConfigId);
      if (!adapter) {
        const config = await loadAdapterConfig(result.adapterConfigId);
        if (!config) {
          log.warn(
            { adapterConfigId: result.adapterConfigId, resultId: result.id },
            'Adapter config not found or disabled, skipping result'
          );
          continue;
        }
        adapter = registry.createInstance(config.platformId, config);
        adapterCache.set(result.adapterConfigId, adapter);
      }

      // Reconstruct PlatformResponse from stored columns
      const platformResponse: PlatformResponse = {
        rawResponse: result.rawResponse,
        textContent: result.textContent ?? '',
        metadata: result.responseMetadata as PlatformResponse['metadata'],
      };

      // Extract raw citations from adapter
      const rawCitations = await adapter.extractCitations(platformResponse, brand);

      // Filter to brand-relevant citations
      const relevant = filterBrandRelevantCitations(rawCitations, result.textContent ?? '', brand);

      // Classify citation type based on prompt content
      const type = classifyCitationType(result.interpolatedPrompt, brand);

      // Map to insert rows
      for (const { citation: cit, relevanceSignal } of relevant) {
        const snippet = cit.snippet || null;
        const sentiment = analyzeSentiment(snippet);
        const normalized = normalizeUrl(cit.url);
        allInsertRows.push({
          id: generatePrefixedId('citation'),
          workspaceId,
          brandId: run.brandId,
          modelRunId: runId,
          modelRunResultId: result.id,
          platformId: result.platformId,
          citationType: type,
          position: cit.position,
          contextSnippet: snippet,
          relevanceSignal,
          sourceUrl: cit.url,
          title: cit.title || null,
          locale: run.locale ?? null,
          sentimentLabel: sentiment?.label ?? null,
          sentimentScore: sentiment?.score.toString() ?? null,
          sentimentConfidence: sentiment?.confidence.toString() ?? null,
          normalizedUrl: normalized?.normalizedUrl ?? null,
          domain: normalized?.domain ?? null,
        });
      }
    } catch (err) {
      log.warn(
        { error: err instanceof Error ? err.message : String(err), resultId: result.id },
        'Failed to extract citations from result, skipping'
      );
    }
  }

  // 5. Batch insert with idempotency
  let insertedCount = 0;
  if (allInsertRows.length > 0) {
    const inserted = await db
      .insert(citation)
      .values(allInsertRows)
      .onConflictDoNothing({ target: [citation.modelRunResultId, citation.sourceUrl] })
      .returning({ id: citation.id });

    insertedCount = inserted.length;
  }

  log.info(
    {
      resultsProcessed: results.length,
      citationsFound: allInsertRows.length,
      citationsInserted: insertedCount,
    },
    'Citation extraction complete'
  );

  // 6. Dispatch webhook if citations were inserted
  if (insertedCount > 0) {
    try {
      await dispatchWebhookEvent(
        workspaceId,
        'citation.new',
        {
          citations: allInsertRows.map((row) => ({
            id: row.id,
            modelRunId: row.modelRunId,
            modelRunResultId: row.modelRunResultId,
            brandId: row.brandId,
            platformId: row.platformId,
            citationType: row.citationType,
            position: row.position,
            sourceUrl: row.sourceUrl,
            title: row.title,
            contextSnippet: row.contextSnippet,
            relevanceSignal: row.relevanceSignal,
          })),
        },
        boss
      );
    } catch (err) {
      log.warn(
        { error: err instanceof Error ? err.message : String(err) },
        'Failed to dispatch citation.new webhook (citations are persisted)'
      );
    }
  }

  // 6b. Extract observed query-fanout per result. Runs after citations are
  // committed so citationId reconciliation can match against authoritative
  // citation rows. Failures never break the enclosing job: the service
  // catches its own errors and returns `{ skipped: true }`.
  for (const result of results) {
    try {
      await runQueryFanoutForResult({
        workspaceId,
        modelRunId: runId,
        result,
        log,
        boss,
      });
    } catch (err) {
      log.warn(
        {
          error: err instanceof Error ? err.message : String(err),
          modelRunResultId: result.id,
          platformId: result.platformId,
        },
        'Query fan-out step threw unexpectedly (citations are persisted)'
      );
    }
  }

  // 7. Enqueue recommendation share computation for the day this model run started
  try {
    const citationDate = run.startedAt
      ? run.startedAt.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    await boss.send(
      'recommendation-share-compute',
      {
        workspaceId,
        promptSetId: run.promptSetId,
        date: citationDate,
      },
      {
        singletonKey: `${workspaceId}:${run.promptSetId}:${citationDate}`,
        singletonSeconds: 60,
      }
    );
  } catch (err) {
    log.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to enqueue recommendation share compute (citations are persisted)'
    );
  }

  // 8. Enqueue sentiment aggregate computation
  try {
    const sentimentDate = run.startedAt
      ? run.startedAt.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    await boss.send(
      'sentiment-aggregate-compute',
      {
        workspaceId,
        promptSetId: run.promptSetId,
        date: sentimentDate,
      },
      {
        singletonKey: `sentiment:${workspaceId}:${run.promptSetId}:${sentimentDate}`,
        singletonSeconds: 60,
      }
    );
  } catch (err) {
    log.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to enqueue sentiment aggregate compute (citations are persisted)'
    );
  }

  // 9. Enqueue citation source aggregate computation
  try {
    const sourceDate = run.startedAt
      ? run.startedAt.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    await boss.send(
      'citation-source-compute',
      {
        workspaceId,
        promptSetId: run.promptSetId,
        date: sourceDate,
      },
      {
        singletonKey: `citation-source:${workspaceId}:${run.promptSetId}:${sourceDate}`,
        singletonSeconds: 60,
      }
    );
  } catch (err) {
    log.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to enqueue citation source compute (citations are persisted)'
    );
  }

  // 10. Enqueue position aggregate computation
  try {
    const positionDate = run.startedAt
      ? run.startedAt.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    await boss.send(
      'position-aggregate-compute',
      {
        workspaceId,
        promptSetId: run.promptSetId,
        date: positionDate,
      },
      {
        singletonKey: `position:${workspaceId}:${run.promptSetId}:${positionDate}`,
        singletonSeconds: 60,
      }
    );
  } catch (err) {
    log.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to enqueue position aggregate compute (citations are persisted)'
    );
  }
}

// -- Internal helpers -------------------------------------------------------

function hasCredentials(credentials: unknown): boolean {
  return (
    credentials !== null &&
    typeof credentials === 'object' &&
    'ciphertext' in (credentials as Record<string, unknown>)
  );
}

async function loadAdapterConfig(adapterConfigId: string): Promise<AdapterConfig | null> {
  const [record] = await db
    .select()
    .from(platformAdapter)
    .where(and(eq(platformAdapter.id, adapterConfigId), eq(platformAdapter.enabled, true)))
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
