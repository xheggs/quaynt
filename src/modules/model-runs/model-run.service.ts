import { eq, and, desc, sql } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { paginationConfig, sortConfig, countTotal, applyDateRange } from '@/lib/db/query-helpers';
import { modelRun, modelRunResult } from './model-run.schema';
import { getPromptSet, listPrompts } from '@/modules/prompt-sets/prompt-set.service';
import { getBrand } from '@/modules/brands/brand.service';
import { getAdapterConfig } from '@/modules/adapters/adapter.service';

const SORT_COLUMNS = {
  createdAt: modelRun.createdAt,
  startedAt: modelRun.startedAt,
  completedAt: modelRun.completedAt,
};

export const MODEL_RUN_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

// -- Helpers ----------------------------------------------------------------

function modelRunFields() {
  return {
    id: modelRun.id,
    workspaceId: modelRun.workspaceId,
    promptSetId: modelRun.promptSetId,
    brandId: modelRun.brandId,
    adapterConfigIds: modelRun.adapterConfigIds,
    locale: modelRun.locale,
    market: modelRun.market,
    status: modelRun.status,
    totalResults: modelRun.totalResults,
    pendingResults: modelRun.pendingResults,
    errorSummary: modelRun.errorSummary,
    startedAt: modelRun.startedAt,
    completedAt: modelRun.completedAt,
    createdAt: modelRun.createdAt,
    updatedAt: modelRun.updatedAt,
  };
}

// -- CRUD -------------------------------------------------------------------

export async function createModelRun(
  workspaceId: string,
  input: {
    promptSetId: string;
    brandId: string;
    adapterConfigIds: string[];
    locale?: string;
    market?: string;
  },
  boss: PgBoss
) {
  // Validate prompt set exists
  const promptSetRecord = await getPromptSet(input.promptSetId, workspaceId);
  if (!promptSetRecord) {
    throw new Error('Prompt set not found');
  }

  // Validate brand exists
  const brandRecord = await getBrand(input.brandId, workspaceId);
  if (!brandRecord) {
    throw new Error('Brand not found');
  }

  // Validate all adapter configs exist and are enabled
  for (const adapterConfigId of input.adapterConfigIds) {
    const config = await getAdapterConfig(adapterConfigId, workspaceId);
    if (!config) {
      throw new Error(`Adapter configuration not found: ${adapterConfigId}`);
    }
    if (!config.enabled) {
      throw new Error(`Adapter configuration is disabled: ${adapterConfigId}`);
    }
  }

  // Get prompts count for totalResults calculation
  const prompts = await listPrompts(input.promptSetId, workspaceId);
  if (!prompts || prompts.length === 0) {
    throw new Error('Prompt set has no prompts');
  }

  const totalResults = prompts.length * input.adapterConfigIds.length;

  const [created] = await db
    .insert(modelRun)
    .values({
      workspaceId,
      promptSetId: input.promptSetId,
      brandId: input.brandId,
      adapterConfigIds: input.adapterConfigIds,
      locale: input.locale ?? null,
      market: input.market ?? null,
      status: 'pending',
      totalResults,
      pendingResults: totalResults,
    })
    .returning(modelRunFields());

  // Dispatch coordinator job
  await boss.send(
    'model-run-execute',
    {
      runId: created.id,
      workspaceId,
    },
    {
      retryLimit: 3,
      retryDelay: 5,
      retryBackoff: true,
      singletonKey: created.id,
    }
  );

  return created;
}

export async function getModelRun(runId: string, workspaceId: string) {
  const [record] = await db
    .select(modelRunFields())
    .from(modelRun)
    .where(and(eq(modelRun.id, runId), eq(modelRun.workspaceId, workspaceId)))
    .limit(1);

  if (!record) return null;

  // Single SQL roll-up grouped by (adapterConfigId, status). The flat
  // resultSummary is reduced from the same rows so we don't need a second
  // round-trip; per-adapter rows feed the first-run page's adapter grid.
  const summaryRows = await db
    .select({
      adapterConfigId: modelRunResult.adapterConfigId,
      status: modelRunResult.status,
      count: sql<number>`count(*)::int`,
    })
    .from(modelRunResult)
    .where(eq(modelRunResult.modelRunId, runId))
    .groupBy(modelRunResult.adapterConfigId, modelRunResult.status);

  const resultSummary = {
    total: record.totalResults,
    completed: 0,
    failed: 0,
    pending: 0,
    running: 0,
    skipped: 0,
  };

  type AdapterCounts = {
    adapterConfigId: string;
    total: number;
    completed: number;
    failed: number;
    pending: number;
    running: number;
    skipped: number;
  };
  const adapterMap = new Map<string, AdapterCounts>();

  for (const row of summaryRows) {
    if (row.status in resultSummary) {
      resultSummary[row.status as keyof typeof resultSummary] += row.count;
    }
    let bucket = adapterMap.get(row.adapterConfigId);
    if (!bucket) {
      bucket = {
        adapterConfigId: row.adapterConfigId,
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        running: 0,
        skipped: 0,
      };
      adapterMap.set(row.adapterConfigId, bucket);
    }
    if (row.status in bucket) {
      bucket[row.status as 'completed' | 'failed' | 'pending' | 'running' | 'skipped'] += row.count;
    }
    bucket.total += row.count;
  }

  const adapterSummary = Array.from(adapterMap.values());

  return { ...record, resultSummary, adapterSummary };
}

export async function listModelRuns(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  filters?: {
    status?: string;
    promptSetId?: string;
    brandId?: string;
    locale?: string;
    from?: string;
    to?: string;
  }
) {
  const conditions: SQL[] = [eq(modelRun.workspaceId, workspaceId)];

  if (filters?.status) {
    conditions.push(
      eq(modelRun.status, filters.status as (typeof modelRun.status.enumValues)[number])
    );
  }
  if (filters?.promptSetId) {
    conditions.push(eq(modelRun.promptSetId, filters.promptSetId));
  }
  if (filters?.brandId) {
    conditions.push(eq(modelRun.brandId, filters.brandId));
  }
  if (filters?.locale) {
    conditions.push(eq(modelRun.locale, filters.locale));
  }
  if (filters?.from || filters?.to) {
    applyDateRange(conditions, { from: filters?.from, to: filters?.to }, modelRun.createdAt);
  }

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select(modelRunFields())
      .from(modelRun)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(modelRun.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(modelRun, conditions),
  ]);

  return { items, total };
}

export async function cancelModelRun(runId: string, workspaceId: string) {
  // Load current run
  const [current] = await db
    .select({ id: modelRun.id, status: modelRun.status, pendingResults: modelRun.pendingResults })
    .from(modelRun)
    .where(and(eq(modelRun.id, runId), eq(modelRun.workspaceId, workspaceId)))
    .limit(1);

  if (!current) {
    return null;
  }

  if (current.status !== 'pending' && current.status !== 'running') {
    throw new Error(`Model run is already ${current.status}`);
  }

  const now = new Date();

  // Bulk-update pending results to skipped
  const skippedResults = await db
    .update(modelRunResult)
    .set({ status: 'skipped', completedAt: now })
    .where(and(eq(modelRunResult.modelRunId, runId), eq(modelRunResult.status, 'pending')))
    .returning({ id: modelRunResult.id });

  const skippedCount = skippedResults.length;

  // Update run status to cancelled and decrement pendingResults
  const [updated] = await db
    .update(modelRun)
    .set({
      status: 'cancelled',
      completedAt: now,
      pendingResults: sql`${modelRun.pendingResults} - ${skippedCount}`,
    })
    .where(and(eq(modelRun.id, runId), eq(modelRun.workspaceId, workspaceId)))
    .returning(modelRunFields());

  return updated ?? null;
}

// -- Result queries ---------------------------------------------------------

export async function listModelRunResults(
  runId: string,
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  filters?: {
    status?: string;
    adapterConfigId?: string;
  }
) {
  // Verify the run belongs to the workspace
  const [run] = await db
    .select({ id: modelRun.id })
    .from(modelRun)
    .where(and(eq(modelRun.id, runId), eq(modelRun.workspaceId, workspaceId)))
    .limit(1);

  if (!run) return null;

  const conditions: SQL[] = [eq(modelRunResult.modelRunId, runId)];

  if (filters?.status) {
    conditions.push(
      eq(modelRunResult.status, filters.status as (typeof modelRunResult.status.enumValues)[number])
    );
  }
  if (filters?.adapterConfigId) {
    conditions.push(eq(modelRunResult.adapterConfigId, filters.adapterConfigId));
  }

  const { limit, offset } = paginationConfig(pagination);

  const RESULT_SORT_COLUMNS: Record<string, Column> = {
    createdAt: modelRunResult.createdAt,
    startedAt: modelRunResult.startedAt,
    completedAt: modelRunResult.completedAt,
  };

  const orderBy = sortConfig(pagination, RESULT_SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select({
        id: modelRunResult.id,
        modelRunId: modelRunResult.modelRunId,
        promptId: modelRunResult.promptId,
        adapterConfigId: modelRunResult.adapterConfigId,
        platformId: modelRunResult.platformId,
        interpolatedPrompt: modelRunResult.interpolatedPrompt,
        status: modelRunResult.status,
        textContent: modelRunResult.textContent,
        responseMetadata: modelRunResult.responseMetadata,
        error: modelRunResult.error,
        startedAt: modelRunResult.startedAt,
        completedAt: modelRunResult.completedAt,
        createdAt: modelRunResult.createdAt,
        updatedAt: modelRunResult.updatedAt,
      })
      .from(modelRunResult)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(modelRunResult.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(modelRunResult, conditions),
  ]);

  return { items, total };
}

export const MODEL_RUN_RESULT_ALLOWED_SORTS = ['createdAt', 'startedAt', 'completedAt'];
