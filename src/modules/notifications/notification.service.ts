import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq, and, isNull, or, arrayContains } from 'drizzle-orm';
import { z } from 'zod';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { notificationPreference, notificationLog } from './notification.schema';
import { user } from '@/modules/auth/auth.schema';
import { workspaceMember } from '@/modules/workspace/workspace.schema';
import { createEmailTransport } from './email/email.transport';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { webhookEndpoint } from '@/modules/webhooks/webhook-endpoint.schema';
import {
  renderAlertEmail,
  renderDigestEmail,
  loadAlertTranslations,
  t,
  formatNumber,
  METRIC_KEYS,
  CONDITION_KEYS,
} from './notification.render';
import type { NotificationSeverityFilter, AlertEventRow, AlertRuleRow } from './notification.types';

const log = logger.child({ module: 'notifications' });

// Re-export rendering functions for backward compatibility
export { renderAlertEmail, renderDigestEmail };

export async function getOrCreatePreference(workspaceId: string, userId: string, channel: string) {
  const [existing] = await db
    .select()
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.workspaceId, workspaceId),
        eq(notificationPreference.userId, userId),
        eq(notificationPreference.channel, channel)
      )
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(notificationPreference)
    .values({ workspaceId, userId, channel })
    .onConflictDoNothing()
    .returning();

  // If conflict, another process created it — fetch and return
  if (!created) {
    const [fetched] = await db
      .select()
      .from(notificationPreference)
      .where(
        and(
          eq(notificationPreference.workspaceId, workspaceId),
          eq(notificationPreference.userId, userId),
          eq(notificationPreference.channel, channel)
        )
      )
      .limit(1);
    return fetched;
  }

  return created;
}

const updatePreferenceSchema = z.object({
  enabled: z.boolean().optional(),
  digestFrequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).optional(),
  digestHour: z.number().int().min(0).max(23).optional(),
  digestDay: z.number().int().min(0).max(6).optional(),
  digestTimezone: z.string().optional(),
  severityFilter: z
    .array(z.enum(['info', 'warning', 'critical']))
    .min(1)
    .optional(),
});

export type PreferenceUpdate = z.infer<typeof updatePreferenceSchema>;

export async function updatePreference(
  workspaceId: string,
  userId: string,
  channel: string,
  updates: PreferenceUpdate
) {
  const validated = updatePreferenceSchema.parse(updates);

  const setValues: Record<string, unknown> = {};
  if (validated.enabled !== undefined) setValues.enabled = validated.enabled;
  if (validated.digestFrequency !== undefined)
    setValues.digestFrequency = validated.digestFrequency;
  if (validated.digestHour !== undefined) setValues.digestHour = validated.digestHour;
  if (validated.digestDay !== undefined) setValues.digestDay = validated.digestDay;
  if (validated.digestTimezone !== undefined) setValues.digestTimezone = validated.digestTimezone;
  if (validated.severityFilter !== undefined) setValues.severityFilter = validated.severityFilter;

  if (Object.keys(setValues).length === 0) {
    return getOrCreatePreference(workspaceId, userId, channel);
  }

  const [updated] = await db
    .update(notificationPreference)
    .set(setValues)
    .where(
      and(
        eq(notificationPreference.workspaceId, workspaceId),
        eq(notificationPreference.userId, userId),
        eq(notificationPreference.channel, channel)
      )
    )
    .returning();

  return updated;
}

export async function getPreferencesForWorkspace(workspaceId: string, channel: string) {
  return db
    .select({
      preference: notificationPreference,
      email: user.email,
      userName: user.name,
    })
    .from(notificationPreference)
    .innerJoin(user, eq(notificationPreference.userId, user.id))
    .where(
      and(
        eq(notificationPreference.workspaceId, workspaceId),
        eq(notificationPreference.channel, channel),
        eq(notificationPreference.enabled, true)
      )
    );
}

// --- Unsubscribe tokens ---

export function generateUnsubscribeToken(userId: string, workspaceId: string): string {
  const payload = `${userId}:${workspaceId}:email`;
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const hmac = createHmac('sha256', env.BETTER_AUTH_SECRET).update(payload).digest('base64url');
  return `${payloadB64}.${hmac}`;
}

export async function validateUnsubscribeToken(
  token: string
): Promise<
  | { valid: true; userId: string; workspaceId: string; channel: string }
  | { valid: false; error: 'INVALID_TOKEN' | 'NOT_MEMBER' }
> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return { valid: false, error: 'INVALID_TOKEN' };

  const payloadB64 = token.slice(0, dotIndex);
  const receivedHmac = token.slice(dotIndex + 1);

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString();
  } catch {
    return { valid: false, error: 'INVALID_TOKEN' };
  }

  const expectedHmac = createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(payload)
    .digest('base64url');

  try {
    const receivedBuf = Buffer.from(receivedHmac, 'base64url');
    const expectedBuf = Buffer.from(expectedHmac, 'base64url');
    if (receivedBuf.length !== expectedBuf.length || !timingSafeEqual(receivedBuf, expectedBuf)) {
      return { valid: false, error: 'INVALID_TOKEN' };
    }
  } catch {
    return { valid: false, error: 'INVALID_TOKEN' };
  }

  const parts = payload.split(':');
  if (parts.length !== 3) return { valid: false, error: 'INVALID_TOKEN' };
  const [userId, workspaceId, channel] = parts;

  // Verify workspace membership
  const [member] = await db
    .select({ id: workspaceMember.id })
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)))
    .limit(1);

  if (!member) return { valid: false, error: 'NOT_MEMBER' };

  return { valid: true, userId, workspaceId, channel };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

// --- Email dispatch ---

export async function dispatchAlertEmail(
  alertEvent: AlertEventRow,
  rule: AlertRuleRow,
  boss: PgBoss
) {
  const transport = createEmailTransport();
  if (!transport) {
    log.debug('Email not enabled, skipping alert email dispatch');
    return;
  }

  const prefs = await getPreferencesForWorkspace(alertEvent.workspaceId, 'email');
  if (prefs.length === 0) {
    log.debug({ workspaceId: alertEvent.workspaceId }, 'No email preferences for workspace');
    return;
  }

  const baseUrl = env.BETTER_AUTH_URL;

  for (const { preference, email } of prefs) {
    const severityFilter = preference.severityFilter as NotificationSeverityFilter;
    if (!severityFilter.includes(alertEvent.severity as 'info' | 'warning' | 'critical')) {
      continue;
    }

    // Critical severity always sends immediately regardless of digest preference
    const isImmediate =
      preference.digestFrequency === 'immediate' || alertEvent.severity === 'critical';

    if (!isImmediate) {
      // Digest jobs will pick up this event
      continue;
    }

    try {
      const unsubscribeUrl = `${baseUrl}/api/v1/notifications/unsubscribe?token=${generateUnsubscribeToken(preference.userId!, alertEvent.workspaceId)}`;
      const rendered = await renderAlertEmail(alertEvent, rule, 'en', baseUrl, unsubscribeUrl);

      // Insert notification log row (claims the event for this user)
      const [logEntry] = await db
        .insert(notificationLog)
        .values({
          workspaceId: alertEvent.workspaceId,
          userId: preference.userId,
          alertEventId: alertEvent.id,
          channel: 'email',
          status: 'pending',
          recipientEmail: email,
          subject: rendered.subject,
        })
        .onConflictDoNothing()
        .returning();

      if (!logEntry) {
        log.debug(
          { alertEventId: alertEvent.id, userId: preference.userId },
          'Alert email already dispatched'
        );
        continue;
      }

      await boss.send(
        'email-send',
        {
          notificationLogId: logEntry.id,
          recipientEmail: email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          headers: rendered.headers,
        },
        {
          retryLimit: 5,
          retryDelay: 5,
          retryBackoff: true,
          expireInSeconds: 3600,
        }
      );

      log.info(
        { alertEventId: alertEvent.id, userId: preference.userId, email: maskEmail(email) },
        'Alert email dispatched'
      );
    } catch (err) {
      log.error(
        { error: err instanceof Error ? err.message : String(err), alertEventId: alertEvent.id },
        'Failed to dispatch alert email'
      );
    }
  }
}

// --- Workspace-level preference CRUD (for webhook channel) ---

export async function getOrCreateWorkspacePreference(workspaceId: string, channel: string) {
  const [existing] = await db
    .select()
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.workspaceId, workspaceId),
        isNull(notificationPreference.userId),
        eq(notificationPreference.channel, channel)
      )
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(notificationPreference)
    .values({ workspaceId, userId: null, channel })
    .onConflictDoNothing()
    .returning();

  // If conflict, another process created it — fetch and return
  if (!created) {
    const [fetched] = await db
      .select()
      .from(notificationPreference)
      .where(
        and(
          eq(notificationPreference.workspaceId, workspaceId),
          isNull(notificationPreference.userId),
          eq(notificationPreference.channel, channel)
        )
      )
      .limit(1);
    return fetched;
  }

  return created;
}

const updateWorkspacePreferenceSchema = z.object({
  enabled: z.boolean().optional(),
  severityFilter: z
    .array(z.enum(['info', 'warning', 'critical']))
    .min(1)
    .optional(),
});

export type WorkspacePreferenceUpdate = z.infer<typeof updateWorkspacePreferenceSchema>;

export async function updateWorkspacePreference(
  workspaceId: string,
  channel: string,
  updates: WorkspacePreferenceUpdate
) {
  const validated = updateWorkspacePreferenceSchema.parse(updates);

  const setValues: Record<string, unknown> = {};
  if (validated.enabled !== undefined) setValues.enabled = validated.enabled;
  if (validated.severityFilter !== undefined) setValues.severityFilter = validated.severityFilter;

  if (Object.keys(setValues).length === 0) {
    return getOrCreateWorkspacePreference(workspaceId, channel);
  }

  const [updated] = await db
    .update(notificationPreference)
    .set(setValues)
    .where(
      and(
        eq(notificationPreference.workspaceId, workspaceId),
        isNull(notificationPreference.userId),
        eq(notificationPreference.channel, channel)
      )
    )
    .returning();

  return updated;
}

// --- Webhook dispatch ---

async function buildWebhookAlertSummary(
  alertEvent: AlertEventRow,
  rule: AlertRuleRow
): Promise<string> {
  const alertT = await loadAlertTranslations('en');
  const scope = alertEvent.scopeSnapshot;
  const brandName = scope.brandName ?? scope.brandId;
  const metricLabel = t(alertT, METRIC_KEYS[rule.metric] ?? rule.metric);
  const conditionLabel = t(alertT, CONDITION_KEYS[alertEvent.condition] ?? alertEvent.condition);
  const currentValue = formatNumber(alertEvent.metricValue, 'en');
  const previousValue = alertEvent.previousValue
    ? formatNumber(alertEvent.previousValue, 'en')
    : '—';
  const severityLabel = t(alertT, `severity.${alertEvent.severity}`);

  return t(alertT, 'notifications.webhook.summary', {
    severity: severityLabel,
    brandName,
    metricLabel,
    conditionLabel,
    currentValue,
    previousValue,
  });
}

export async function dispatchAlertWebhook(
  alertEvent: AlertEventRow,
  rule: AlertRuleRow,
  boss: PgBoss
) {
  // 1. Load/create workspace-level webhook preference
  const pref = await getOrCreateWorkspacePreference(alertEvent.workspaceId, 'webhook');
  if (!pref || !pref.enabled) {
    log.debug({ workspaceId: alertEvent.workspaceId }, 'Webhook notifications disabled');
    return;
  }

  // 2. Check severity filter
  const severityFilter = pref.severityFilter as NotificationSeverityFilter;
  if (!severityFilter.includes(alertEvent.severity as 'info' | 'warning' | 'critical')) {
    log.debug({ severity: alertEvent.severity }, 'Alert severity filtered for webhook');
    return;
  }

  // 3. Build enriched payload
  const baseUrl = env.BETTER_AUTH_URL;
  const summary = await buildWebhookAlertSummary(alertEvent, rule);
  const url = `${baseUrl}/api/v1/alerts/events/${alertEvent.id}/view`;
  const scope = alertEvent.scopeSnapshot;

  const enrichedData = {
    alert: {
      ruleId: rule.id,
      ruleName: rule.name,
      eventId: alertEvent.id,
      metric: rule.metric,
      condition: alertEvent.condition,
      threshold: Number(alertEvent.threshold),
      severity: alertEvent.severity,
      currentValue: Number(alertEvent.metricValue),
      previousValue: alertEvent.previousValue ? Number(alertEvent.previousValue) : null,
      scope,
      promptSetId: alertEvent.alertRuleId,
      triggeredAt: alertEvent.triggeredAt.toISOString(),
      summary,
      url,
    },
  };

  // 4. Dispatch via webhook infrastructure
  await dispatchWebhookEvent(alertEvent.workspaceId, 'alert.triggered', enrichedData, boss);

  // 5. Get endpoint URLs for notification_log entries
  const endpoints = await db
    .select({ id: webhookEndpoint.id, url: webhookEndpoint.url })
    .from(webhookEndpoint)
    .where(
      and(
        eq(webhookEndpoint.workspaceId, alertEvent.workspaceId),
        eq(webhookEndpoint.enabled, true),
        or(
          arrayContains(webhookEndpoint.events, ['alert.triggered']),
          arrayContains(webhookEndpoint.events, ['*'])
        )
      )
    );

  // 6. Create notification_log entries per endpoint
  for (const endpoint of endpoints) {
    try {
      await db
        .insert(notificationLog)
        .values({
          workspaceId: alertEvent.workspaceId,
          userId: null,
          alertEventId: alertEvent.id,
          channel: 'webhook',
          status: 'pending',
          recipientEmail: null,
          recipient: endpoint.url,
        })
        .onConflictDoNothing();
    } catch (err) {
      log.warn(
        { error: err instanceof Error ? err.message : String(err), endpointUrl: endpoint.url },
        'Failed to create webhook notification log entry'
      );
    }
  }

  log.info(
    { alertEventId: alertEvent.id, endpointCount: endpoints.length },
    'Alert webhook dispatched'
  );
}
