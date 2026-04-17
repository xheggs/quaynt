import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { workspace } from '@/modules/workspace/workspace.schema';
import { trafficSiteKey } from './traffic-site-key.schema';

/**
 * Individual AI-sourced visit records.
 *
 * The visit schema is intentionally PII-free:
 *   - No IP address (used only for rate-limit bookkeeping, never persisted here)
 *   - No full user agent (stored as a coarse family: Chrome/Safari/Firefox/Edge/Other)
 *   - No cookie, session, or device identifier of any kind
 *   - No fingerprint-derived column
 *
 * Sources: `snippet` (JS snippet POSTs), `log` (server-log imports from PRP 6.2b).
 * Google Search Console data lives in its own `gsc_query_performance` table —
 * see `src/modules/integrations/gsc-correlation/`.
 */
export const aiVisit = pgTable(
  'ai_visit',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('aiVisit')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    source: text().notNull(), // 'snippet' | 'log'
    platform: text().notNull(), // slug from ai-source-dictionary
    referrerHost: text(),
    landingPath: text().notNull(),
    userAgentFamily: text().notNull(),
    siteKeyId: text().references(() => trafficSiteKey.id, { onDelete: 'set null' }),
    visitedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_visit_workspace_visited_idx').on(table.workspaceId, table.visitedAt),
    index('ai_visit_workspace_platform_visited_idx').on(
      table.workspaceId,
      table.platform,
      table.visitedAt
    ),
    index('ai_visit_workspace_source_visited_idx').on(
      table.workspaceId,
      table.source,
      table.visitedAt
    ),
    index('ai_visit_site_key_idx').on(table.siteKeyId),
  ]
);
