import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import type { ScheduleScope } from './scheduled-report.types';

export const scheduleFrequencyEnum = pgEnum('schedule_frequency', ['daily', 'weekly', 'monthly']);

export const scheduleFormatEnum = pgEnum('schedule_format', ['pdf', 'csv', 'json']);

export const recipientTypeEnum = pgEnum('recipient_type', ['email', 'webhook']);

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'generating',
  'delivered',
  'failed',
]);

export const reportSchedule = pgTable(
  'report_schedule',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('reportSchedule')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    createdBy: text().notNull(),
    name: text().notNull(),
    frequency: scheduleFrequencyEnum().notNull(),
    hour: integer().notNull().default(9),
    dayOfWeek: integer().notNull().default(1),
    dayOfMonth: integer().notNull().default(1),
    timezone: text().notNull().default('UTC'),
    format: scheduleFormatEnum().notNull().default('pdf'),
    scope: jsonb().$type<ScheduleScope>().notNull(),
    enabled: boolean().notNull().default(true),
    lastRunAt: timestamp({ withTimezone: true, mode: 'date' }),
    nextRunAt: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
    consecutiveFailures: integer().notNull().default(0),
    lastError: text(),
    deletedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('report_schedule_ws_name_idx')
      .on(table.workspaceId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    index('report_schedule_due_idx')
      .on(table.enabled, table.deletedAt, table.nextRunAt)
      .where(sql`${table.enabled} = true AND ${table.deletedAt} IS NULL`),
    index('report_schedule_workspace_id_idx').on(table.workspaceId),
  ]
);

export const scheduleRecipient = pgTable(
  'schedule_recipient',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('scheduleRecipient')),
    scheduleId: text()
      .notNull()
      .references(() => reportSchedule.id, { onDelete: 'cascade' }),
    type: recipientTypeEnum().notNull(),
    address: text().notNull(),
    unsubscribed: boolean().notNull().default(false),
    unsubscribedAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('schedule_recipient_schedule_type_address_idx').on(
      table.scheduleId,
      table.type,
      table.address
    ),
    index('schedule_recipient_active_idx')
      .on(table.scheduleId)
      .where(sql`${table.unsubscribed} = false`),
  ]
);

export const reportDelivery = pgTable(
  'report_delivery',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('reportDelivery')),
    scheduleId: text()
      .notNull()
      .references(() => reportSchedule.id),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    reportJobId: text(),
    recipientId: text()
      .notNull()
      .references(() => scheduleRecipient.id),
    format: text().notNull(),
    filePath: text(),
    status: deliveryStatusEnum().notNull().default('pending'),
    errorMessage: text(),
    deliveredAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('report_delivery_schedule_created_idx').on(table.scheduleId, table.createdAt),
    index('report_delivery_workspace_idx').on(table.workspaceId),
  ]
);
