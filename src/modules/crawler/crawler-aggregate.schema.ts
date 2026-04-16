import {
  pgTable,
  text,
  integer,
  numeric,
  date,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';

/**
 * Pre-computed daily aggregates for crawler analytics.
 * The `_all_` sentinel in botName stores workspace-wide rollups per day.
 */
export const crawlerDailyAggregate = pgTable(
  'crawler_daily_aggregate',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('crawlerAgg')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    periodStart: date({ mode: 'string' }).notNull(),
    botName: text().notNull(), // bot name or '_all_' for workspace rollup
    botCategory: text().notNull(), // 'search' | 'training' | 'user_action' | '_all_'
    visitCount: integer().notNull().default(0),
    uniquePaths: integer().notNull().default(0),
    avgResponseBytes: numeric({ precision: 12, scale: 2 }).notNull().default('0'),
    statusBreakdown: jsonb().$type<Record<string, number>>().notNull().default({}),
    topPaths: jsonb().$type<Array<{ path: string; count: number }>>().notNull().default([]),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('crawler_agg_unique_idx').on(
      table.workspaceId,
      table.periodStart,
      table.botName,
      table.botCategory
    ),
    index('crawler_agg_workspace_period_idx').on(table.workspaceId, table.periodStart),
  ]
);
