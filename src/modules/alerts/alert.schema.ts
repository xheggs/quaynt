import {
  pgTable,
  text,
  integer,
  boolean,
  numeric,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generatePrefixedId } from '@/lib/db/id';
import { timestamps } from '@/lib/db/helpers';
import { workspace } from '@/modules/workspace/workspace.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import type { AlertScope } from './alert.types';

export const alertRule = pgTable(
  'alert_rule',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('alertRule')),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    metric: text().notNull(),
    promptSetId: text()
      .notNull()
      .references(() => promptSet.id, { onDelete: 'cascade' }),
    scope: jsonb().$type<AlertScope>().notNull(),
    condition: text().notNull(),
    threshold: numeric({ precision: 12, scale: 4 }).notNull(),
    direction: text().notNull().default('any'),
    cooldownMinutes: integer().notNull().default(60),
    severity: text().notNull().default('warning'),
    enabled: boolean().notNull().default(true),
    lastEvaluatedAt: timestamp({ withTimezone: true, mode: 'date' }),
    lastTriggeredAt: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('alert_rule_workspace_metric_prompt_set_idx')
      .on(table.workspaceId, table.metric, table.promptSetId)
      .where(sql`${table.enabled} = true`),
    index('alert_rule_workspace_idx').on(table.workspaceId),
  ]
);

export const alertEvent = pgTable(
  'alert_event',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => generatePrefixedId('alertEvent')),
    alertRuleId: text()
      .notNull()
      .references(() => alertRule.id, { onDelete: 'cascade' }),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    severity: text().notNull(),
    metricValue: numeric({ precision: 12, scale: 4 }).notNull(),
    previousValue: numeric({ precision: 12, scale: 4 }),
    threshold: numeric({ precision: 12, scale: 4 }).notNull(),
    condition: text().notNull(),
    scopeSnapshot: jsonb()
      .$type<AlertScope & { brandName?: string; platformName?: string }>()
      .notNull(),
    triggeredAt: timestamp({ withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    acknowledgedAt: timestamp({ withTimezone: true, mode: 'date' }),
    snoozedUntil: timestamp({ withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    index('alert_event_rule_idx').on(table.alertRuleId, table.triggeredAt),
    index('alert_event_workspace_idx').on(table.workspaceId, table.triggeredAt),
    index('alert_event_workspace_severity_ack_idx').on(
      table.workspaceId,
      table.severity,
      table.acknowledgedAt
    ),
    index('alert_event_workspace_snoozed_idx').on(table.workspaceId, table.snoozedUntil),
  ]
);
