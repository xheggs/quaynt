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

export const positionAggregate = pgTable(
  'position_aggregate',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('positionAggregate')),
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
    citationCount: integer().notNull(),
    averagePosition: numeric({ precision: 5, scale: 2 }).notNull(),
    medianPosition: numeric({ precision: 5, scale: 2 }).notNull(),
    minPosition: integer().notNull(),
    maxPosition: integer().notNull(),
    firstMentionCount: integer().notNull(),
    firstMentionRate: numeric({ precision: 5, scale: 2 }).notNull(),
    topThreeCount: integer().notNull(),
    topThreeRate: numeric({ precision: 5, scale: 2 }).notNull(),
    positionDistribution: jsonb().$type<Record<string, number>>().notNull(),
    modelRunCount: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('position_aggregate_unique_idx').on(
      table.workspaceId,
      table.promptSetId,
      table.brandId,
      table.platformId,
      table.locale,
      table.periodStart
    ),
    index('position_aggregate_workspace_id_idx').on(table.workspaceId),
    index('position_aggregate_brand_id_idx').on(table.brandId),
    index('position_aggregate_prompt_set_id_idx').on(table.promptSetId),
    index('position_aggregate_workspace_brand_period_idx').on(
      table.workspaceId,
      table.brandId,
      table.periodStart
    ),
  ]
);
