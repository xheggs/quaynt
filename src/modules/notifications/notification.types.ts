export type DigestFrequency = 'immediate' | 'hourly' | 'daily' | 'weekly';

export type NotificationChannel = 'email' | 'webhook';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'bounced';

export type NotificationSeverityFilter = Array<'info' | 'warning' | 'critical'>;

export interface EmailSendJobData {
  notificationLogId: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export type DigestJobData = Record<string, never>;

export type AlertEventRow = {
  id: string;
  workspaceId: string;
  severity: string;
  metricValue: string;
  previousValue: string | null;
  threshold: string;
  condition: string;
  scopeSnapshot: { brandId: string; brandName?: string; platformName?: string; locale?: string };
  triggeredAt: Date;
  alertRuleId: string;
};

export type AlertRuleRow = {
  id: string;
  name: string;
  metric: string;
  severity: string;
};
