import { pgTable, text, integer, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';

export const crawlerUpload = pgTable(
  'crawler_upload',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('crawlerUpload')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    filename: text().notNull(),
    format: text().notNull(), // 'apache' | 'nginx' | 'cloudfront'
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    contentHash: text().notNull(), // SHA-256 of raw file for dedup
    status: text().notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
    linesTotal: integer().default(0),
    linesParsed: integer().default(0),
    linesSkipped: integer().default(0),
    errorMessage: text(),
    ...timestamps,
  },
  (table) => [
    index('crawler_upload_workspace_id_idx').on(table.workspaceId),
    index('crawler_upload_workspace_status_idx').on(table.workspaceId, table.status),
    uniqueIndex('crawler_upload_workspace_hash_idx').on(table.workspaceId, table.contentHash),
  ]
);
