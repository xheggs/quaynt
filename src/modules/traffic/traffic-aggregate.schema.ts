import { pgTable, text, integer, date, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';

/**
 * Pre-computed daily rollups of ai_visit rows.
 *
 * `_all_` sentinels mean "any value" on that axis — one row per (workspace, date,
 * source=X, platform='_all_') stores the per-source total, and one row with both set to
 * `_all_` stores the workspace-wide total.
 *
 * `uniquePages` counts distinct landing paths (not distinct visitors — we have no way to
 * count visitors without a persistent identifier, which this module intentionally omits).
 */
export const trafficDailyAggregate = pgTable(
  'traffic_daily_aggregate',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('trafficAggregate')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    periodStart: date({ mode: 'string' }).notNull(),
    source: text().notNull(), // 'snippet' | 'log' | '_all_'
    platform: text().notNull(), // slug from ai-source-dictionary or '_all_'
    visitCount: integer().notNull().default(0),
    uniquePages: integer().notNull().default(0),
    topPages: jsonb().$type<Array<{ path: string; count: number }>>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('traffic_agg_unique_idx').on(
      table.workspaceId,
      table.periodStart,
      table.source,
      table.platform
    ),
    index('traffic_agg_workspace_period_idx').on(table.workspaceId, table.periodStart),
  ]
);
