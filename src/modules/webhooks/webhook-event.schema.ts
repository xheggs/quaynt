import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { workspace } from '@/modules/workspace/workspace.schema';

export const webhookEvent = pgTable(
  'webhook_event',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('webhookEvent')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    eventType: text().notNull(),
    payload: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('webhook_event_workspace_id_idx').on(table.workspaceId),
    index('webhook_event_event_type_idx').on(table.eventType),
    index('webhook_event_created_at_idx').on(table.createdAt),
  ]
);
