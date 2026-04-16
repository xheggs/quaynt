/**
 * Client-side alert types.
 *
 * These mirror the server-side types from @/modules/alerts/alert.types
 * and @/modules/notifications/notification.types but are duplicated here
 * to avoid importing from server modules, which can pull in server-side
 * dependencies through barrel re-exports and break client component bundling.
 */

// Source: @/modules/alerts/alert.types
export type AlertMetric =
  | 'recommendation_share'
  | 'citation_count'
  | 'sentiment_score'
  | 'position_average';

// Source: @/modules/alerts/alert.types
export type AlertCondition =
  | 'drops_below'
  | 'exceeds'
  | 'changes_by_percent'
  | 'changes_by_absolute';

// Source: @/modules/alerts/alert.types
export type AlertSeverity = 'info' | 'warning' | 'critical';

// Source: @/modules/alerts/alert.types
export type AlertDirection = 'any' | 'increase' | 'decrease';

// Source: @/modules/alerts/alert.types
export type AlertEventStatus = 'active' | 'acknowledged' | 'snoozed';

// Source: @/modules/alerts/alert.types
export interface AlertScope {
  brandId: string;
  platformId?: string;
  locale?: string;
}

// Source: @/modules/alerts/alert.schema (alertRule table shape)
export interface AlertRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  metric: AlertMetric;
  promptSetId: string;
  scope: AlertScope;
  condition: AlertCondition;
  threshold: string;
  direction: AlertDirection;
  cooldownMinutes: number;
  severity: AlertSeverity;
  enabled: boolean;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Source: @/modules/alerts/alert.types
export interface AlertRuleCreate {
  name: string;
  description?: string;
  metric: AlertMetric;
  promptSetId: string;
  scope: AlertScope;
  condition: AlertCondition;
  threshold: number;
  direction?: AlertDirection;
  cooldownMinutes?: number;
  severity?: AlertSeverity;
  enabled?: boolean;
}

// Source: @/modules/alerts/alert.types
export interface AlertRuleUpdate {
  name?: string;
  description?: string | null;
  scope?: AlertScope;
  condition?: AlertCondition;
  threshold?: number;
  direction?: AlertDirection;
  cooldownMinutes?: number;
  severity?: AlertSeverity;
  enabled?: boolean;
}

// Source: @/modules/alerts/alert.schema (alertEvent table shape + joined ruleName)
export interface AlertEvent {
  id: string;
  alertRuleId: string;
  ruleName: string | null;
  workspaceId: string;
  severity: AlertSeverity;
  metricValue: string;
  previousValue: string | null;
  threshold: string;
  condition: AlertCondition;
  scopeSnapshot: AlertScope & { brandName?: string; platformName?: string };
  triggeredAt: string;
  acknowledgedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

// Source: @/modules/alerts/alert.types
export interface AlertSnoozeInput {
  duration?: number;
  snoozedUntil?: string;
}

// Source: @/modules/alerts/alert.types
export interface AlertSummary {
  total: number;
  active: number;
  acknowledged: number;
  snoozed: number;
  bySeverity: { info: number; warning: number; critical: number };
  topRules: Array<{ ruleId: string; ruleName: string | null; count: number }>;
  period: { from: string; to: string };
}

// Source: @/modules/notifications/notification.types
export type NotificationChannel = 'email' | 'webhook';

// Source: @/modules/notifications/notification.types
export type DigestFrequency = 'immediate' | 'hourly' | 'daily' | 'weekly';

// Source: @/modules/notifications/notification.schema (notificationPreference table shape)
export interface NotificationPreference {
  id: string;
  workspaceId: string;
  userId: string | null;
  channel: NotificationChannel;
  enabled: boolean;
  digestFrequency: DigestFrequency;
  digestHour: number;
  digestDay: number;
  digestTimezone: string;
  severityFilter: AlertSeverity[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferencesResponse {
  email: NotificationPreference | null;
  webhook: NotificationPreference | null;
}

export interface EmailPreferenceUpdate {
  enabled?: boolean;
  digestFrequency?: DigestFrequency;
  digestHour?: number;
  digestDay?: number;
  digestTimezone?: string;
  severityFilter?: AlertSeverity[];
}

export interface WebhookPreferenceUpdate {
  enabled?: boolean;
  severityFilter?: AlertSeverity[];
}

/** ID-to-name lookup map for resolving IDs to display names. */
export type NameLookup = Record<string, string>;

// --- Helper constants ---

export const ALERT_METRICS: AlertMetric[] = [
  'recommendation_share',
  'citation_count',
  'sentiment_score',
  'position_average',
];

export const ALERT_CONDITIONS: AlertCondition[] = [
  'drops_below',
  'exceeds',
  'changes_by_percent',
  'changes_by_absolute',
];

export const ALERT_SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical'];

export const ALERT_DIRECTIONS: AlertDirection[] = ['any', 'increase', 'decrease'];

export const EVENT_STATUSES: AlertEventStatus[] = ['active', 'acknowledged', 'snoozed'];

export const DIGEST_FREQUENCIES: DigestFrequency[] = ['immediate', 'hourly', 'daily', 'weekly'];

/**
 * Derives the effective status of an alert event from its timestamps.
 * Priority: acknowledged > snoozed (if not expired) > active
 */
export function deriveEventStatus(event: AlertEvent): AlertEventStatus {
  if (event.acknowledgedAt) return 'acknowledged';
  if (event.snoozedUntil && new Date(event.snoozedUntil) > new Date()) return 'snoozed';
  return 'active';
}
