import { pgTable, text, integer, date, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';

export const citationSourceAggregate = pgTable(
  'citation_source_aggregate',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('citationSourceAggregate')),
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
    domain: text().notNull(),
    periodStart: date({ mode: 'string' }).notNull(),
    frequency: integer().notNull(),
    firstSeenAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    lastSeenAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('csa_unique_idx').on(
      table.workspaceId,
      table.promptSetId,
      table.brandId,
      table.platformId,
      table.locale,
      table.domain,
      table.periodStart
    ),
    index('csa_workspace_id_idx').on(table.workspaceId),
    index('csa_brand_id_idx').on(table.brandId),
    index('csa_prompt_set_id_idx').on(table.promptSetId),
    index('csa_workspace_promptset_period_idx').on(
      table.workspaceId,
      table.promptSetId,
      table.periodStart
    ),
    index('csa_workspace_domain_idx').on(table.workspaceId, table.domain),
  ]
);
