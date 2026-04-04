import {
  pgTable,
  text,
  integer,
  date,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { prompt } from '@/modules/prompt-sets/prompt.schema';

export const opportunity = pgTable(
  'opportunity',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('opportunity')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    brandId: text()
      .notNull()
      .references(() => brand.id, { onDelete: 'cascade' }),
    promptSetId: text()
      .notNull()
      .references(() => promptSet.id, { onDelete: 'cascade' }),
    promptId: text()
      .notNull()
      .references(() => prompt.id, { onDelete: 'cascade' }),
    periodStart: date({ mode: 'string' }).notNull(),
    type: text().notNull(), // 'missing' or 'weak'
    score: numeric({ precision: 5, scale: 2 }).notNull(),
    competitorCount: integer().notNull(),
    totalTrackedBrands: integer().notNull(),
    platformCount: integer().notNull(),
    brandCitationCount: integer().notNull(),
    competitors: jsonb().notNull(), // [{ brandId, brandName, citationCount }]
    platformBreakdown: jsonb().notNull(), // [{ platformId, brandGapOnPlatform, competitorCount }]
    ...timestamps,
  },
  (table) => [
    uniqueIndex('opportunity_unique_idx').on(
      table.workspaceId,
      table.promptSetId,
      table.brandId,
      table.promptId,
      table.periodStart
    ),
    index('opportunity_workspace_brand_promptset_period_idx').on(
      table.workspaceId,
      table.brandId,
      table.promptSetId,
      table.periodStart
    ),
    index('opportunity_workspace_promptset_period_idx').on(
      table.workspaceId,
      table.promptSetId,
      table.periodStart
    ),
  ]
);
