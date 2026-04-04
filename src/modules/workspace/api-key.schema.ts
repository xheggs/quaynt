import { index, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { workspace } from './workspace.schema';

export const apiKeyScopeEnum = pgEnum('api_key_scope', ['read', 'read-write', 'admin']);

export const apiKey = pgTable(
  'api_key',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('apiKey')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    keyHash: text().notNull().unique(),
    keyPrefix: varchar({ length: 12 }).notNull(),
    scopes: apiKeyScopeEnum().notNull().default('read'),
    lastUsedAt: timestamp({ withTimezone: true, mode: 'date' }),
    expiresAt: timestamp({ withTimezone: true, mode: 'date' }),
    revokedAt: timestamp({ withTimezone: true, mode: 'date' }),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('api_key_workspace_id_idx').on(table.workspaceId),
    index('api_key_key_prefix_idx').on(table.keyPrefix),
  ]
);
