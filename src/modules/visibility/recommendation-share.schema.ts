import { pgTable, text, integer, date, numeric, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';

export const recommendationShare = pgTable(
  'recommendation_share',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('recommendationShare')),
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
    sharePercentage: numeric({ precision: 5, scale: 2 }).notNull(),
    citationCount: integer().notNull(),
    totalCitations: integer().notNull(),
    modelRunCount: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('recommendation_share_unique_idx').on(
      table.workspaceId,
      table.promptSetId,
      table.brandId,
      table.platformId,
      table.locale,
      table.periodStart
    ),
    index('recommendation_share_workspace_id_idx').on(table.workspaceId),
    index('recommendation_share_brand_id_idx').on(table.brandId),
    index('recommendation_share_prompt_set_id_idx').on(table.promptSetId),
    index('recommendation_share_workspace_brand_period_idx').on(
      table.workspaceId,
      table.brandId,
      table.periodStart
    ),
  ]
);
