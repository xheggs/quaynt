import { boolean, index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { timestamps } from '@/lib/db/helpers';
import { generatePrefixedId } from '@/lib/db/id';
import { workspace } from '@/modules/workspace/workspace.schema';

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending',
  'success',
  'failed',
]);

export const webhookEndpoint = pgTable(
  'webhook_endpoint',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('webhookEndpoint')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    description: text(),
    secret: text().notNull(),
    events: text().array().notNull(),
    enabled: boolean().notNull().default(true),
    disabledAt: timestamp({ withTimezone: true, mode: 'date' }),
    disabledReason: text(),
    failingSince: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [index('webhook_endpoint_workspace_id_idx').on(table.workspaceId)]
);
