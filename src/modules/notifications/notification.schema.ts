import {
  pgTable,
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
import { user } from '@/modules/auth/auth.schema';
import { alertEvent } from '@/modules/alerts/alert.schema';
import type { NotificationSeverityFilter } from './notification.types';

export const notificationPreference = pgTable(
  'notification_preference',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('notificationPref')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    userId: text().references(() => user.id, { onDelete: 'cascade' }),
    channel: text().notNull(),
    enabled: boolean().notNull().default(true),
    digestFrequency: text().notNull().default('immediate'),
    digestHour: integer().notNull().default(9),
    digestDay: integer().notNull().default(1),
    digestTimezone: text().notNull().default('UTC'),
    severityFilter: jsonb()
      .$type<NotificationSeverityFilter>()
      .notNull()
      .default(sql`'["info","warning","critical"]'::jsonb`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('notification_preference_ws_user_channel_idx')
      .on(table.workspaceId, table.userId, table.channel)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex('notification_preference_ws_channel_no_user_idx')
      .on(table.workspaceId, table.channel)
      .where(sql`${table.userId} IS NULL`),
    index('notification_preference_ws_channel_enabled_idx')
      .on(table.workspaceId, table.channel)
      .where(sql`${table.enabled} = true`),
  ]
);

export const notificationLog = pgTable(
  'notification_log',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('notificationLog')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    userId: text().references(() => user.id, { onDelete: 'cascade' }),
    alertEventId: text()
      .notNull()
      .references(() => alertEvent.id, { onDelete: 'cascade' }),
    digestBatchId: text(),
    channel: text().notNull(),
    status: text().notNull(),
    recipientEmail: text(),
    recipient: text(),
    subject: text(),
    messageId: text(),
    errorMessage: text(),
    sentAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('notification_log_event_user_channel_idx')
      .on(table.alertEventId, table.userId, table.channel)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex('notification_log_event_channel_recipient_idx')
      .on(table.alertEventId, table.channel, table.recipient)
      .where(sql`${table.userId} IS NULL`),
    index('notification_log_event_idx').on(table.alertEventId),
    index('notification_log_ws_user_sent_idx').on(table.workspaceId, table.userId, table.sentAt),
  ]
);
