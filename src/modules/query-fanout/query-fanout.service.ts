import type { PgBoss } from 'pg-boss';
import type { Logger } from 'pino';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { generatePrefixedId } from '@/lib/db/id';
import { citation } from '@/modules/citations/citation.schema';
import { normalizeUrl } from '@/modules/citations/url-normalize';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { queryFanoutNode } from './query-fanout.schema';
import { extractObservedFanout } from './query-fanout.extractor';
import type {
  FanoutNodeKind,
  FanoutNodeSource,
  ObservedFanoutTree,
  QueryFanoutExtractorInput,
} from './query-fanout.types';

export {
  getFanoutByModelRun,
  getFanoutByModelRunResult,
  type FanoutSourceFilter,
} from './query-fanout.reader';

// Database type with the runtime session available inside a transaction, used
// by `insertFanoutTree`. Kept structural rather than exported from drizzle to
// avoid leaking the full Transaction<...> generic to callers.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface RunQueryFanoutInput {
  workspaceId: string;
  modelRunId: string;
  result: QueryFanoutExtractorInput & { promptId: string };
  log: Pick<Logger, 'info' | 'warn' | 'debug'>;
  boss: PgBoss;
}

interface RunQueryFanoutResult {
  skipped: boolean;
  reason?: string;
  insertedNodes?: number;
  rootNodes?: number;
  subQueryNodes?: number;
  sourceNodes?: number;
}

/**
 * Extract fan-out for a single model-run-result, persist the tree into
 * `query_fanout_node`, and dispatch the `query_fanout.extracted` webhook.
 *
 * Called from inside the citation pipeline after the run's citations have been
 * inserted. Extractor errors are caught — this function never throws: fan-out
 * is a best-effort enhancement that must not break citation extraction.
 */
export async function runQueryFanoutForResult(
  input: RunQueryFanoutInput
): Promise<RunQueryFanoutResult> {
  const { workspaceId, modelRunId, result, log, boss } = input;

  let tree: ObservedFanoutTree | null = null;
  try {
    tree = extractObservedFanout(result);
  } catch (err) {
    log.warn(
      {
        msg: 'query-fanout extraction parse failed',
        platformId: result.platformId,
        modelRunResultId: result.id,
        error: err instanceof Error ? err.message : String(err),
      },
      'Fan-out extractor threw; skipping result'
    );
    return { skipped: true, reason: 'extractor-threw' };
  }

  if (!tree) {
    log.debug(
      { platformId: result.platformId, modelRunResultId: result.id },
      'No fan-out data produced by extractor; skipping'
    );
    return { skipped: true, reason: 'no-data' };
  }

  // Build authoritative (normalizedUrl → citationId) map by selecting the
  // row's citations fresh from the DB. We cannot trust in-memory generated
  // IDs because onConflictDoNothing may have rejected them in favour of
  // pre-existing rows.
  const citationRows = await db
    .select({
      id: citation.id,
      normalizedUrl: citation.normalizedUrl,
    })
    .from(citation)
    .where(eq(citation.modelRunResultId, result.id));

  const citationByNormalizedUrl = new Map<string, string>();
  for (const row of citationRows) {
    if (row.normalizedUrl) citationByNormalizedUrl.set(row.normalizedUrl, row.id);
  }

  // Idempotency for observed rows: delete-then-insert inside a tx so re-runs
  // replace the tree. Simulated rows use the partial unique index in
  // `query_fanout_node_simulated_dedup_idx` for dedup instead.
  let inserted = 0;
  let subQueryNodes = 0;
  let sourceNodes = 0;
  try {
    await db.transaction(async (tx) => {
      await tx.delete(queryFanoutNode).where(eq(queryFanoutNode.modelRunResultId, result.id));
      const { insertedNodes, subQueryNodeCount, sourceNodeCount } = await insertFanoutTree(tx, {
        workspaceId,
        modelRunId,
        modelRunResultId: result.id,
        platformId: result.platformId,
        promptId: result.promptId,
        tree,
        source: 'observed',
        simulationProvider: null,
        simulationModel: null,
        citationByNormalizedUrl,
      });
      inserted = insertedNodes;
      subQueryNodes = subQueryNodeCount;
      sourceNodes = sourceNodeCount;
    });
  } catch (err) {
    log.warn(
      {
        msg: 'query-fanout insert failed',
        platformId: result.platformId,
        modelRunResultId: result.id,
        error: err instanceof Error ? err.message : String(err),
      },
      'Fan-out bulk insert failed; skipping webhook'
    );
    return { skipped: true, reason: 'insert-failed' };
  }

  const rootNodes = 1;

  log.info(
    {
      platformId: result.platformId,
      modelRunResultId: result.id,
      nodeCount: inserted,
    },
    'Query fan-out extraction complete'
  );

  try {
    await dispatchWebhookEvent(
      workspaceId,
      'query_fanout.extracted',
      {
        modelRunId,
        modelRunResultId: result.id,
        platformId: result.platformId,
        promptId: result.promptId,
        insertedNodes: inserted,
        rootNodes,
        subQueryNodes,
        sourceNodes,
      },
      boss
    );
  } catch (err) {
    log.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to dispatch query_fanout.extracted webhook (fan-out rows persisted)'
    );
  }

  return {
    skipped: false,
    insertedNodes: inserted,
    rootNodes,
    subQueryNodes,
    sourceNodes,
  };
}

// -- Shared tree → rows helper --------------------------------------------

export interface InsertFanoutTreeInput {
  workspaceId: string;
  /** Null for orchestration-free simulated trees. */
  modelRunId: string | null;
  /** Null for orchestration-free simulated trees. */
  modelRunResultId: string | null;
  /** Null for orchestration-free simulated trees; inherited from run context otherwise. */
  platformId: string | null;
  promptId: string;
  tree: ObservedFanoutTree;
  source: FanoutNodeSource;
  /** Populated only when `source = 'simulated'`. */
  simulationProvider: string | null;
  /** Populated only when `source = 'simulated'`. */
  simulationModel: string | null;
  /** Observed rows use this to reconcile to a citation row; pass `new Map()` for simulations. */
  citationByNormalizedUrl: Map<string, string>;
}

export interface InsertFanoutTreeResult {
  insertedNodes: number;
  rootNodeId: string;
  subQueryNodeCount: number;
  sourceNodeCount: number;
}

/**
 * Flatten an `ObservedFanoutTree` into rows and bulk-insert them inside the
 * caller's transaction. Shared by the observed (`runQueryFanoutForResult`) and
 * simulated (`runSimulationPipeline`) ingest paths.
 *
 * For simulated rows, `citationByNormalizedUrl` is irrelevant (simulations
 * never emit source children). For observed rows, deduplication is handled by
 * the caller's delete-then-insert pattern; for simulated rows, the partial
 * unique index `query_fanout_node_simulated_dedup_idx` handles dedup on
 * conflicting inserts — callers wrap with `onConflictDoNothing()`.
 */
export async function insertFanoutTree(
  tx: Tx,
  input: InsertFanoutTreeInput
): Promise<InsertFanoutTreeResult> {
  const {
    workspaceId,
    modelRunId,
    modelRunResultId,
    platformId,
    promptId,
    tree,
    source,
    simulationProvider,
    simulationModel,
    citationByNormalizedUrl,
  } = input;

  const rootId = generatePrefixedId('queryFanoutNode');
  const rows: (typeof queryFanoutNode.$inferInsert)[] = [];
  let subQueryNodeCount = 0;
  let sourceNodeCount = 0;

  const baseRow = {
    workspaceId,
    modelRunId,
    modelRunResultId,
    platformId,
    promptId,
    source,
    simulationProvider,
    simulationModel,
  };

  rows.push({
    ...baseRow,
    id: rootId,
    parentNodeId: null,
    kind: 'root' as FanoutNodeKind,
    subQueryText: tree.root.text,
    sourceUrl: null,
    normalizedUrl: null,
    sourceTitle: null,
    citationId: null,
    intentType: null,
    metadata: tree.metadata ?? null,
  });

  for (const subQuery of tree.subQueries) {
    const subQueryId = generatePrefixedId('queryFanoutNode');
    subQueryNodeCount += 1;
    // Simulator emits intentType via metadata.intentType; observed trees do not.
    const intentType =
      source === 'simulated' && typeof subQuery.metadata?.intentType === 'string'
        ? (subQuery.metadata.intentType as string)
        : null;
    rows.push({
      ...baseRow,
      id: subQueryId,
      parentNodeId: rootId,
      kind: 'sub_query' as FanoutNodeKind,
      subQueryText: subQuery.text,
      sourceUrl: null,
      normalizedUrl: null,
      sourceTitle: null,
      citationId: null,
      intentType,
      metadata: subQuery.metadata ?? null,
    });
    for (const sourceRef of subQuery.sources) {
      sourceNodeCount += 1;
      rows.push(
        buildSourceRow(
          { ...baseRow, intentType: null },
          subQueryId,
          sourceRef,
          citationByNormalizedUrl
        )
      );
    }
  }

  for (const sourceRef of tree.rootSources) {
    sourceNodeCount += 1;
    rows.push(
      buildSourceRow({ ...baseRow, intentType: null }, rootId, sourceRef, citationByNormalizedUrl)
    );
  }

  if (rows.length === 0) {
    return { insertedNodes: 0, rootNodeId: rootId, subQueryNodeCount, sourceNodeCount };
  }

  let inserted: { id: string }[];
  if (source === 'simulated') {
    // Rely on the partial unique index for idempotency — duplicate simulations
    // for the same (workspaceId, promptId, ...) silently drop.
    inserted = await tx
      .insert(queryFanoutNode)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: queryFanoutNode.id });
  } else {
    inserted = await tx.insert(queryFanoutNode).values(rows).returning({ id: queryFanoutNode.id });
  }

  return {
    insertedNodes: inserted.length,
    rootNodeId: rootId,
    subQueryNodeCount,
    sourceNodeCount,
  };
}

interface BaseRowForSource {
  workspaceId: string;
  modelRunId: string | null;
  modelRunResultId: string | null;
  platformId: string | null;
  promptId: string;
  source: FanoutNodeSource;
  simulationProvider: string | null;
  simulationModel: string | null;
  intentType: string | null;
}

function buildSourceRow(
  baseRow: BaseRowForSource,
  parentNodeId: string,
  source: { url: string; title?: string },
  citationByNormalizedUrl: Map<string, string>
): typeof queryFanoutNode.$inferInsert {
  const normalized = normalizeUrl(source.url);
  const normalizedUrl = normalized?.normalizedUrl ?? null;
  const citationId = normalizedUrl ? (citationByNormalizedUrl.get(normalizedUrl) ?? null) : null;
  return {
    ...baseRow,
    id: generatePrefixedId('queryFanoutNode'),
    parentNodeId,
    kind: 'source' as FanoutNodeKind,
    subQueryText: null,
    sourceUrl: source.url,
    normalizedUrl,
    sourceTitle: source.title ?? null,
    citationId,
    metadata: null,
  };
}

export async function deleteFanoutForResult(modelRunResultId: string): Promise<void> {
  await db.delete(queryFanoutNode).where(eq(queryFanoutNode.modelRunResultId, modelRunResultId));
}

// -- Utility: used by tests to verify authoritative mapping ---------------

export async function getCitationIdsByModelRunResult(
  modelRunResultId: string
): Promise<Array<{ id: string; normalizedUrl: string | null }>> {
  return db
    .select({ id: citation.id, normalizedUrl: citation.normalizedUrl })
    .from(citation)
    .where(inArray(citation.modelRunResultId, [modelRunResultId]));
}
