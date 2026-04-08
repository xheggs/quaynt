import { pgTable, text, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import type {
  TemplateLayout,
  TemplateBranding,
  TemplateCoverOverrides,
} from './report-template.types';

export const reportTemplate = pgTable(
  'report_template',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('reportTemplate')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    createdBy: text().notNull(),
    name: text().notNull(),
    description: text(),
    layout: jsonb().$type<TemplateLayout>().notNull(),
    branding: jsonb().$type<TemplateBranding>().notNull(),
    coverOverrides: jsonb().$type<TemplateCoverOverrides>(),
    deletedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('report_template_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('report_template_ws_name_idx')
      .on(table.workspaceId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);
