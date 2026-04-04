import { pgTable, text, integer, date, numeric, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';

export const sentimentAggregate = pgTable(
  'sentiment_aggregate',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('sentimentAggregate')),
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
    periodStart: date({ mode: 'string' }).notNull(),
    positiveCount: integer().notNull(),
    neutralCount: integer().notNull(),
    negativeCount: integer().notNull(),
    totalCount: integer().notNull(),
    positivePercentage: numeric({ precision: 5, scale: 2 }).notNull(),
    neutralPercentage: numeric({ precision: 5, scale: 2 }).notNull(),
    negativePercentage: numeric({ precision: 5, scale: 2 }).notNull(),
    netSentimentScore: numeric({ precision: 6, scale: 2 }).notNull(),
    averageScore: numeric({ precision: 5, scale: 4 }),
    modelRunCount: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('sentiment_aggregate_unique_idx').on(
      table.workspaceId,
      table.promptSetId,
      table.brandId,
      table.platformId,
      table.locale,
      table.periodStart
    ),
    index('sentiment_aggregate_workspace_id_idx').on(table.workspaceId),
    index('sentiment_aggregate_brand_id_idx').on(table.brandId),
    index('sentiment_aggregate_prompt_set_id_idx').on(table.promptSetId),
    index('sentiment_aggregate_workspace_brand_period_idx').on(
      table.workspaceId,
      table.brandId,
      table.periodStart
    ),
  ]
);
