import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { generatePrefixedId } from '@/lib/db/id';
import { webhookDeliveryStatusEnum } from './webhook-endpoint.schema';
import { webhookEndpoint } from './webhook-endpoint.schema';
import { webhookEvent } from './webhook-event.schema';

export const webhookDelivery = pgTable(
  'webhook_delivery',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('webhookDelivery')),
    webhookEndpointId: text()
      .notNull()
      .references(() => webhookEndpoint.id, { onDelete: 'cascade' }),
    webhookEventId: text()
      .notNull()
      .references(() => webhookEvent.id, { onDelete: 'cascade' }),
    attemptNumber: integer().notNull().default(0),
    status: webhookDeliveryStatusEnum().notNull().default('pending'),
    httpStatus: integer(),
    responseBody: text(),
    responseLatencyMs: integer(),
    errorMessage: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    completedAt: timestamp({ withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('webhook_delivery_endpoint_id_idx').on(table.webhookEndpointId),
    index('webhook_delivery_event_id_idx').on(table.webhookEventId),
    index('webhook_delivery_status_idx').on(table.status),
  ]
);
