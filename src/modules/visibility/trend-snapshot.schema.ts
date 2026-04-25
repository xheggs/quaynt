import {
  pgTable,
  text,
  integer,
  date,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';

export const trendSnapshot = pgTable(
  'trend_snapshot',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('trendSnapshot')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    brandId: text()
      .notNull()
      .references(() => brand.id, { onDelete: 'cascade' }),
    promptSetId: text()
      .notNull()
      .references(() => promptSet.id, { onDelete: 'cascade' }),
    platformId: text().notNull(), // '_all' sentinel for aggregate rows
    locale: text().notNull(), // '_all' sentinel for aggregate rows
    metric: text().notNull(), // TrendMetric value
    period: text().notNull(), // 'weekly' or 'monthly'
    periodStart: date({ mode: 'string' }).notNull(),
    periodEnd: date({ mode: 'string' }).notNull(),
    value: numeric({ precision: 10, scale: 4 }).notNull(),
    previousValue: numeric({ precision: 10, scale: 4 }),
    delta: numeric({ precision: 10, scale: 4 }),
    changeRate: numeric({ precision: 8, scale: 4 }),
    ewmaValue: numeric({ precision: 10, scale: 4 }),
    ewmaUpper: numeric({ precision: 10, scale: 4 }),
    ewmaLower: numeric({ precision: 10, scale: 4 }),
    isAnomaly: boolean().notNull().default(false),
    anomalyDirection: text(), // 'above' | 'below' | null
    isSignificant: boolean(), // null if insufficient data
    pValue: numeric({ precision: 6, scale: 4 }),
    confidenceLower: numeric({ precision: 10, scale: 4 }),
    confidenceUpper: numeric({ precision: 10, scale: 4 }),
    sampleSize: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('trend_snapshot_unique_idx').on(
      table.workspaceId,
      table.promptSetId,
      table.brandId,
      table.platformId,
      table.locale,
      table.metric,
      table.period,
      table.periodStart
    ),
    index('trend_snapshot_workspace_brand_idx').on(
      table.workspaceId,
      table.brandId,
      table.periodStart
    ),
    index('trend_snapshot_anomaly_idx')
      .on(table.workspaceId, table.isAnomaly)
      .where(sql`${table.isAnomaly} = true`),
  ]
);
