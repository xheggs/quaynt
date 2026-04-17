import { pgTable, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import type { EncryptedValue } from '@/modules/adapters/adapter.types';

/**
 * Google Search Console OAuth connection.
 *
 * Stores OAuth tokens encrypted at rest (AES-256-GCM via adapter.crypto). Tokens
 * are never returned through the API, never logged, and decrypted only inside
 * the GSC client at request time.
 *
 * Status values:
 *   - 'active': normal operating state
 *   - 'reauth_required': refresh token rejected by Google, UI prompts reconnect
 *   - 'forbidden': Google returned 403 (property access revoked)
 *   - 'revoked': user disconnected (row remains briefly then is deleted)
 */
export const gscConnection = pgTable(
  'gsc_connection',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('gscConnection')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    propertyUrl: text().notNull(),
    accessTokenEncrypted: jsonb().$type<EncryptedValue>().notNull(),
    refreshTokenEncrypted: jsonb().$type<EncryptedValue>().notNull(),
    tokenExpiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    scope: text().notNull(),
    status: text().notNull().default('active'),
    connectedAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    lastSyncAt: timestamp({ withTimezone: true, mode: 'date' }),
    lastSyncStatus: text(),
    lastSyncError: text(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('gsc_connection_workspace_property_idx').on(table.workspaceId, table.propertyUrl),
    index('gsc_connection_workspace_status_idx').on(table.workspaceId, table.status),
  ]
);
