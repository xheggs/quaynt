import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { queryFanoutNode } from './query-fanout.schema';
import type {
  QueryFanoutTreeResponse,
  QueryFanoutSourceResponse,
  QueryFanoutSubQueryResponse,
} from './query-fanout.types';

export type FanoutSourceFilter = 'observed' | 'simulated' | 'both';

interface GetFanoutFilters {
  modelRunResultId?: string;
  platformId?: string;
  promptId?: string;
  /** Defaults to `'both'` — simulated rows are flagged via `isSimulated` on each sub-query node. */
  source?: FanoutSourceFilter;
}

/**
 * Return fan-out trees for every result under a model run, shaped for the API.
 * Scoped by workspace — callers never receive cross-workspace data.
 *
 * Observed and simulated rows are flattened into the same tree shape; callers
 * distinguish via `isSimulated` on each sub-query node. Pass `source` to
 * restrict to one type.
 */
export async function getFanoutByModelRun(
  workspaceId: string,
  modelRunId: string,
  filters: GetFanoutFilters = {}
): Promise<QueryFanoutTreeResponse[]> {
  const conditions = [
    eq(queryFanoutNode.workspaceId, workspaceId),
    eq(queryFanoutNode.modelRunId, modelRunId),
  ];
  if (filters.modelRunResultId) {
    conditions.push(eq(queryFanoutNode.modelRunResultId, filters.modelRunResultId));
  }
  if (filters.platformId) {
    conditions.push(eq(queryFanoutNode.platformId, filters.platformId));
  }
  if (filters.promptId) {
    conditions.push(eq(queryFanoutNode.promptId, filters.promptId));
  }
  if (filters.source === 'observed' || filters.source === 'simulated') {
    conditions.push(eq(queryFanoutNode.source, filters.source));
  }

  const nodes = await db
    .select()
    .from(queryFanoutNode)
    .where(and(...conditions))
    .orderBy(queryFanoutNode.modelRunResultId, queryFanoutNode.createdAt);

  return toTreeResponses(nodes);
}

/** Convenience narrower used by the panel section. */
export async function getFanoutByModelRunResult(
  workspaceId: string,
  modelRunResultId: string
): Promise<QueryFanoutTreeResponse[]> {
  const nodes = await db
    .select()
    .from(queryFanoutNode)
    .where(
      and(
        eq(queryFanoutNode.workspaceId, workspaceId),
        eq(queryFanoutNode.modelRunResultId, modelRunResultId)
      )
    )
    .orderBy(queryFanoutNode.createdAt);

  return toTreeResponses(nodes);
}

function toTreeResponses(
  nodes: (typeof queryFanoutNode.$inferSelect)[]
): QueryFanoutTreeResponse[] {
  // Orchestration-free simulated rows have no modelRunResultId; toTreeResponses
  // is result-keyed, so skip them here. PRP 6.3b Task 6 handles those via a
  // dedicated read path when the orchestration-free UI lands.
  const resultScopedNodes = nodes.filter(
    (n): n is typeof queryFanoutNode.$inferSelect & { modelRunResultId: string } =>
      n.modelRunResultId !== null
  );
  const byResult = new Map<string, typeof resultScopedNodes>();
  for (const node of resultScopedNodes) {
    const bucket = byResult.get(node.modelRunResultId);
    if (bucket) bucket.push(node);
    else byResult.set(node.modelRunResultId, [node]);
  }

  const trees: QueryFanoutTreeResponse[] = [];
  for (const [modelRunResultId, bucket] of byResult) {
    const root = bucket.find((n) => n.kind === 'root');
    if (!root) continue;

    const childrenByParent = new Map<string, typeof bucket>();
    for (const node of bucket) {
      if (node.parentNodeId) {
        const list = childrenByParent.get(node.parentNodeId);
        if (list) list.push(node);
        else childrenByParent.set(node.parentNodeId, [node]);
      }
    }

    const rootChildren = childrenByParent.get(root.id) ?? [];
    const subQueryNodes = rootChildren.filter((n) => n.kind === 'sub_query');
    const rootSourceNodes = rootChildren.filter((n) => n.kind === 'source');

    const subQueries: QueryFanoutSubQueryResponse[] = subQueryNodes.map((n) => {
      const sources = (childrenByParent.get(n.id) ?? [])
        .filter((child) => child.kind === 'source')
        .map(toSourceResponse);
      return {
        id: n.id,
        text: n.subQueryText ?? '',
        metadata: (n.metadata as Record<string, unknown> | null) ?? null,
        sources,
        isSimulated: n.source === 'simulated',
        intentType: n.intentType,
        simulationProvider: n.simulationProvider,
        simulationModel: n.simulationModel,
      };
    });

    trees.push({
      modelRunResultId,
      platformId: root.platformId ?? '',
      promptId: root.promptId,
      promptText: root.subQueryText ?? '',
      rootMetadata: (root.metadata as Record<string, unknown> | null) ?? null,
      subQueries,
      rootSources: rootSourceNodes.map(toSourceResponse),
    });
  }

  return trees;
}

function toSourceResponse(node: typeof queryFanoutNode.$inferSelect): QueryFanoutSourceResponse {
  return {
    id: node.id,
    url: node.sourceUrl ?? '',
    title: node.sourceTitle,
    citationId: node.citationId,
  };
}
