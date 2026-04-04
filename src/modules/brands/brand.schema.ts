import { pgTable, text, varchar, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { isNull } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';

export const brand = pgTable(
  'brand',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('brand')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    slug: varchar({ length: 63 }).notNull(),
    domain: text(),
    aliases: text().array().notNull().default([]),
    description: text(),
    metadata: jsonb().notNull().default({}),
    deletedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('brand_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('brand_workspace_slug_idx')
      .on(table.workspaceId, table.slug)
      .where(isNull(table.deletedAt)),
    uniqueIndex('brand_workspace_name_idx')
      .on(table.workspaceId, table.name)
      .where(isNull(table.deletedAt)),
  ]
);
