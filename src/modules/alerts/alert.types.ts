export type AlertMetric =
  | 'recommendation_share'
  | 'citation_count'
  | 'sentiment_score'
  | 'position_average';

export type AlertCondition =
  | 'drops_below'
  | 'exceeds'
  | 'changes_by_percent'
  | 'changes_by_absolute';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertDirection = 'any' | 'increase' | 'decrease';

export interface AlertScope {
  brandId: string;
  platformId?: string;
  locale?: string;
}

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

export interface AlertEvaluateJobData {
  workspaceId: string;
  promptSetId: string;
  metric: AlertMetric;
  date: string;
}

export type AlertEventStatus = 'active' | 'acknowledged' | 'snoozed';

export interface AlertEventFilters {
  alertRuleId?: string;
  severity?: AlertSeverity;
  status?: AlertEventStatus;
  from?: string;
  to?: string;
}

export interface AlertSnoozeInput {
  duration?: number;
  snoozedUntil?: string;
}

export interface AlertSummary {
  total: number;
  active: number;
  acknowledged: number;
  snoozed: number;
  bySeverity: { info: number; warning: number; critical: number };
  topRules: Array<{ ruleId: string; ruleName: string | null; count: number }>;
  period: { from: string; to: string };
}

export interface AlertEvaluationResult {
  ruleId: string;
  conditionMet: boolean;
  currentValue: number;
  previousValue: number | null;
  reason: 'triggered' | 'cooldown_active' | 'condition_not_met' | 'insufficient_data';
}
