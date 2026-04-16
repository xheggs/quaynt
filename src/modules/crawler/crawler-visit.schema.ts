import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { workspace } from '@/modules/workspace/workspace.schema';
import { crawlerUpload } from './crawler-upload.schema';

/**
 * Individual AI bot visit records parsed from server access logs.
 * IP addresses are intentionally NOT stored — they are PII under GDPR
 * and not needed for any analytics feature.
 */
export const crawlerVisit = pgTable(
  'crawler_visit',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('crawlerVisit')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    uploadId: text().references(() => crawlerUpload.id, { onDelete: 'cascade' }),
    botName: text().notNull(),
    botCategory: text().notNull(), // 'search' | 'training' | 'user_action'
    userAgent: text().notNull(),
    requestPath: text().notNull(),
    requestMethod: text().notNull().default('GET'),
    statusCode: integer().notNull(),
    responseBytes: integer().notNull().default(0),
    visitedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('crawler_visit_workspace_visited_idx').on(table.workspaceId, table.visitedAt),
    index('crawler_visit_workspace_bot_visited_idx').on(
      table.workspaceId,
      table.botName,
      table.visitedAt
    ),
    index('crawler_visit_workspace_path_visited_idx').on(
      table.workspaceId,
      table.requestPath,
      table.visitedAt
    ),
    index('crawler_visit_upload_id_idx').on(table.uploadId),
  ]
);
