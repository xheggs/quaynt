import { index, pgTable, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { workspace } from '@/modules/workspace/workspace.schema';

/**
 * Public site keys embedded in the customer's JavaScript snippet. Unlike API keys these
 * are intentionally discoverable (any visitor can see them in the page source), so the
 * threat model is "assume leaked" — mitigations live in the optional allowedOrigins
 * allowlist, per-key rate limiting, and the absence of any mutating privilege.
 */
export const trafficSiteKey = pgTable(
  'traffic_site_key',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('trafficSiteKey')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    keyHash: text().notNull().unique(),
    keyPrefix: varchar({ length: 12 }).notNull(),
    status: text().notNull().default('active'), // 'active' | 'revoked'
    // When empty, any origin is accepted. When populated, only listed origins are accepted.
    allowedOrigins: jsonb().$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp({ withTimezone: true, mode: 'date' }),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    revokedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('traffic_site_key_workspace_idx').on(table.workspaceId),
    index('traffic_site_key_workspace_status_idx').on(table.workspaceId, table.status),
  ]
);
