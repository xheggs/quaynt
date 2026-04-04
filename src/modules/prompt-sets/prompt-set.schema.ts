import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { isNull } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';

export const promptSet = pgTable(
  'prompt_set',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('promptSet')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    tags: text().array().notNull().default([]),
    deletedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('prompt_set_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('prompt_set_workspace_name_idx')
      .on(table.workspaceId, table.name)
      .where(isNull(table.deletedAt)),
  ]
);
