import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { user } from '@/modules/auth/auth.schema';

export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'admin', 'member']);

export const workspace = pgTable(
  'workspace',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('workspace')),
    name: text().notNull(),
    slug: varchar({ length: 63 }).notNull().unique(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => [index('workspace_owner_id_idx').on(table.ownerId)]
);

export const workspaceMember = pgTable(
  'workspace_member',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('workspaceMember')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: workspaceRoleEnum().notNull().default('member'),
    joinedAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workspace_member_ws_user_idx').on(table.workspaceId, table.userId),
    index('workspace_member_user_id_idx').on(table.userId),
  ]
);
