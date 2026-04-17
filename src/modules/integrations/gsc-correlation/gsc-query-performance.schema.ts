import { pgTable, text, integer, numeric, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { gscConnection } from '@/modules/integrations/gsc/gsc-connection.schema';

/**
 * Aggregated GSC search-performance rows.
 *
 * One row per (workspace, connection, date, query, page) tuple. GSC data is
 * aggregated by design — there are no per-user records. Google may retroactively
 * correct historical data, so the sync always upserts on the unique tuple.
 *
 * `propertyUrl` is denormalized from `gsc_connection` for query convenience
 * (avoids an extra join on most read paths).
 */
export const gscQueryPerformance = pgTable(
  'gsc_query_performance',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('gscQueryPerformance')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    gscConnectionId: text()
      .notNull()
      .references(() => gscConnection.id, { onDelete: 'cascade' }),
    propertyUrl: text().notNull(),
    date: date({ mode: 'string' }).notNull(),
    query: text().notNull(),
    page: text().notNull(),
    clicks: integer().notNull().default(0),
    impressions: integer().notNull().default(0),
    ctr: numeric({ precision: 7, scale: 6 }).notNull().default('0'),
    position: numeric({ precision: 7, scale: 3 }).notNull().default('0'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('gsc_query_performance_unique_idx').on(
      table.workspaceId,
      table.gscConnectionId,
      table.date,
      table.query,
      table.page
    ),
    index('gsc_query_performance_workspace_date_idx').on(table.workspaceId, table.date),
    index('gsc_query_performance_workspace_query_idx').on(table.workspaceId, table.query),
  ]
);
