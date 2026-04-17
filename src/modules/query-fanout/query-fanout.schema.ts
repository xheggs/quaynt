import {
  pgTable,
  pgEnum,
  text,
  jsonb,
  index,
  unique,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { modelRun, modelRunResult } from '@/modules/model-runs/model-run.schema';
import { prompt } from '@/modules/prompt-sets/prompt.schema';
import { citation } from '@/modules/citations/citation.schema';

/**
 * Kind of a fan-out tree node.
 *
 * - `root` — synthetic root carrying the user prompt text.
 * - `sub_query` — a decomposed sub-query (Gemini webSearchQueries,
 *   AIO textBlocks, ChatGPT web_search_call.action.query, or an LLM-simulated
 *   sub-query when `source = 'simulated'`).
 * - `source` — a URL that grounded the response. Attached under a sub-query
 *   when per-sub-query attribution is known (AIO); attached under the root
 *   when it is not (Gemini). Never produced by the simulator.
 */
export const queryFanoutNodeKind = pgEnum('query_fanout_node_kind', [
  'root',
  'sub_query',
  'source',
]);

/**
 * Origin of a fan-out node.
 *
 * - `observed` — extracted from a platform's raw response (PRP 6.3a).
 * - `simulated` — produced by the Qforia-style LLM simulator (PRP 6.3b).
 */
export const queryFanoutNodeSource = pgEnum('query_fanout_node_source', ['observed', 'simulated']);

export const queryFanoutNode = pgTable(
  'query_fanout_node',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('queryFanoutNode')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    // Nullable for orchestration-free simulated rows (a user simulated a
    // prompt outside the context of any model run).
    modelRunId: text().references(() => modelRun.id, { onDelete: 'cascade' }),
    modelRunResultId: text().references(() => modelRunResult.id, {
      onDelete: 'cascade',
    }),
    // Nullable for orchestration-free simulations (no run → no platform).
    platformId: text(),
    promptId: text()
      .notNull()
      .references(() => prompt.id),
    parentNodeId: text().references((): AnyPgColumn => queryFanoutNode.id, {
      onDelete: 'cascade',
    }),
    kind: queryFanoutNodeKind().notNull(),
    /** `observed` (default) or `simulated`. Drives downstream rendering and dedup strategy. */
    source: queryFanoutNodeSource().notNull().default('observed'),
    /** Qforia-style intent tag for simulated sub-queries; null for observed or non-subquery nodes. */
    intentType: text(),
    /** Provider used to generate a simulated row (`openai` | `anthropic` | `gemini`). Null for observed. */
    simulationProvider: text(),
    /** Model used to generate a simulated row (e.g., `gpt-4o-mini`). Null for observed. */
    simulationModel: text(),
    subQueryText: text(),
    sourceUrl: text(),
    normalizedUrl: text(),
    sourceTitle: text(),
    citationId: text().references(() => citation.id, { onDelete: 'set null' }),
    metadata: jsonb(),
    ...timestamps,
  },
  (table) => [
    index('query_fanout_node_workspace_run_idx').on(table.workspaceId, table.modelRunId),
    index('query_fanout_node_workspace_result_idx').on(table.workspaceId, table.modelRunResultId),
    index('query_fanout_node_workspace_platform_created_idx').on(
      table.workspaceId,
      table.platformId,
      table.createdAt
    ),
    index('query_fanout_node_parent_idx').on(table.parentNodeId),
    index('query_fanout_node_workspace_prompt_source_idx').on(
      table.workspaceId,
      table.promptId,
      table.source
    ),
    unique('query_fanout_node_dedup_idx')
      .on(
        table.modelRunResultId,
        table.parentNodeId,
        table.kind,
        table.subQueryText,
        table.sourceUrl
      )
      .nullsNotDistinct(),
    // Partial unique index keeps simulated rows deduped without a
    // modelRunResultId (which is null for orchestration-free simulations).
    uniqueIndex('query_fanout_node_simulated_dedup_idx')
      .on(table.workspaceId, table.promptId, table.parentNodeId, table.kind, table.subQueryText)
      .where(sql`${table.source} = 'simulated'`),
    // CHECK constraint on intentType taxonomy. Chosen over pgEnum because the
    // taxonomy is evolving and a CHECK constraint is cheap to drop + re-add.
    check(
      'query_fanout_node_intent_type_check',
      sql`${table.intentType} IS NULL OR ${table.intentType} IN ('related', 'implicit', 'comparative', 'reformulation', 'entity_expansion', 'recent', 'personalised', 'other')`
    ),
  ]
);
