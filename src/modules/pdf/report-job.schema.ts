import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { workspace } from '@/modules/workspace/workspace.schema';
import { timestamps } from '@/lib/db/helpers';

export const reportJobStatusEnum = pgEnum('report_job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'expired',
]);

export interface ReportJobScope {
  promptSetId: string;
  brandIds: string[];
  from?: string;
  to?: string;
  comparisonPeriod?: string;
  metrics?: string[];
  platformId?: string;
  locale?: string;
}

export const reportJob = pgTable(
  'report_job',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('reportJob')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    createdBy: text().notNull(),
    status: reportJobStatusEnum().notNull().default('pending'),
    scope: jsonb().$type<ReportJobScope>().notNull(),
    locale: text().notNull().default('en'),
    filePath: text(),
    fileSizeBytes: integer(),
    pageCount: integer(),
    errorMessage: text(),
    startedAt: timestamp({ withTimezone: true, mode: 'date' }),
    completedAt: timestamp({ withTimezone: true, mode: 'date' }),
    expiresAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    ...timestamps,
  },
  (table) => [
    index('report_job_workspace_id_idx').on(table.workspaceId),
    index('report_job_status_idx').on(table.status),
    index('report_job_expires_at_idx').on(table.expiresAt),
  ]
);
