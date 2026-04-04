import type { PgBoss, JobWithMetadata } from 'pg-boss';
import { eq, and, isNull, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { generatePrefixedId } from '@/lib/db/id';
import { createEmailTransport } from './email/email.transport';
import { notificationPreference, notificationLog } from './notification.schema';
import { alertEvent } from '@/modules/alerts/alert.schema';
import { alertRule } from '@/modules/alerts/alert.schema';
import { user } from '@/modules/auth/auth.schema';
import { renderDigestEmail, generateUnsubscribeToken } from './notification.service';
import type {
  EmailSendJobData,
  DigestFrequency,
  NotificationSeverityFilter,
} from './notification.types';

// --- email-send job ---

async function processEmailSend(job: JobWithMetadata<EmailSendJobData>): Promise<void> {
  const { notificationLogId, recipientEmail, subject, html, text, headers } = job.data;
  const attemptNumber = (job.retryCount ?? 0) + 1;

  const log = logger.child({ notificationLogId, attemptNumber });

  const transport = createEmailTransport();
  if (!transport) {
    log.error('Email transport unavailable in email-send job');
    await db
      .update(notificationLog)
      .set({ status: 'failed', errorMessage: 'Email transport not configured' })
      .where(eq(notificationLog.id, notificationLogId));
    return;
  }

  const result = await transport.send({
    to: recipientEmail,
    subject,
    html,
    text,
    headers,
  });

  if (result.success) {
    await db
      .update(notificationLog)
      .set({
        status: 'sent',
        messageId: result.messageId,
        sentAt: new Date(),
      })
      .where(eq(notificationLog.id, notificationLogId));

    log.info({ messageId: result.messageId }, 'Email sent successfully');
    return;
  }

  // Permanent failure — mark as failed, do not retry
  if (result.permanent) {
    await db
      .update(notificationLog)
      .set({ status: 'failed', errorMessage: result.error })
      .where(eq(notificationLog.id, notificationLogId));

    log.error({ error: result.error }, 'Email send permanently failed');
    return;
  }

  // Transient failure — update error message, throw to trigger retry
  await db
    .update(notificationLog)
    .set({ errorMessage: result.error })
    .where(eq(notificationLog.id, notificationLogId));

  log.warn({ error: result.error }, 'Email send failed, retrying');
  throw new Error(result.error ?? 'Email send failed');
}

// --- Digest helpers ---

function getCurrentHourInTimezone(timezone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const hourPart = parts.find((p) => p.type === 'hour');
  return Number(hourPart?.value ?? 0);
}

function getCurrentDayInTimezone(timezone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).formatToParts(now);

  const dayPart = parts.find((p) => p.type === 'weekday');
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[dayPart?.value ?? 'Mon'] ?? 1;
}

async function getUndeliveredAlertEvents(
  workspaceId: string,
  userId: string,
  since: Date,
  severityFilter: NotificationSeverityFilter
) {
  // Get alert events that have no notification_log row for this user+channel
  const events = await db
    .select({
      id: alertEvent.id,
      workspaceId: alertEvent.workspaceId,
      severity: alertEvent.severity,
      metricValue: alertEvent.metricValue,
      previousValue: alertEvent.previousValue,
      threshold: alertEvent.threshold,
      condition: alertEvent.condition,
      scopeSnapshot: alertEvent.scopeSnapshot,
      triggeredAt: alertEvent.triggeredAt,
      alertRuleId: alertEvent.alertRuleId,
    })
    .from(alertEvent)
    .leftJoin(
      notificationLog,
      and(
        eq(notificationLog.alertEventId, alertEvent.id),
        eq(notificationLog.userId, userId),
        eq(notificationLog.channel, 'email')
      )
    )
    .where(
      and(
        eq(alertEvent.workspaceId, workspaceId),
        gte(alertEvent.triggeredAt, since),
        isNull(notificationLog.id)
      )
    );

  // Filter by severity
  return events.filter((e) =>
    severityFilter.includes(e.severity as 'info' | 'warning' | 'critical')
  );
}

async function getRulesMap(ruleIds: string[]) {
  if (ruleIds.length === 0)
    return new Map<string, { id: string; name: string; metric: string; severity: string }>();

  const rules = await db
    .select({
      id: alertRule.id,
      name: alertRule.name,
      metric: alertRule.metric,
      severity: alertRule.severity,
    })
    .from(alertRule)
    .where(sql`${alertRule.id} IN ${ruleIds}`);

  return new Map(rules.map((r) => [r.id, r]));
}

async function processDigest(
  frequency: DigestFrequency,
  sinceHours: number,
  now: Date,
  boss: PgBoss
): Promise<void> {
  const log = logger.child({ job: `email-digest-${frequency}` });

  const transport = createEmailTransport();
  if (!transport) {
    log.debug('Email not enabled, skipping digest');
    return;
  }

  // Get all workspaces with enabled preferences for this frequency
  const prefs = await db
    .select({
      preference: notificationPreference,
      email: user.email,
    })
    .from(notificationPreference)
    .innerJoin(user, eq(notificationPreference.userId, user.id))
    .where(
      and(
        eq(notificationPreference.channel, 'email'),
        eq(notificationPreference.enabled, true),
        eq(notificationPreference.digestFrequency, frequency)
      )
    );

  const baseUrl = env.BETTER_AUTH_URL;
  const since = new Date(now.getTime() - sinceHours * 60 * 60 * 1000);

  for (const { preference, email } of prefs) {
    // For daily/weekly, check if it's the right hour/day in user's timezone
    if (frequency === 'daily' || frequency === 'weekly') {
      const currentHour = getCurrentHourInTimezone(preference.digestTimezone, now);
      if (currentHour !== preference.digestHour) continue;

      if (frequency === 'weekly') {
        const currentDay = getCurrentDayInTimezone(preference.digestTimezone, now);
        if (currentDay !== preference.digestDay) continue;
      }
    }

    try {
      const severityFilter = preference.severityFilter as NotificationSeverityFilter;
      const events = await getUndeliveredAlertEvents(
        preference.workspaceId,
        preference.userId!,
        since,
        severityFilter
      );

      if (events.length === 0) {
        log.debug(
          { userId: preference.userId, workspaceId: preference.workspaceId },
          'No events for digest'
        );
        continue;
      }

      const ruleIds = [...new Set(events.map((e) => e.alertRuleId))];
      const rulesMap = await getRulesMap(ruleIds);

      // Claim events by inserting notification_log rows
      const digestBatchId = generatePrefixedId('digestBatch');
      let claimedCount = 0;

      for (const event of events) {
        const [inserted] = await db
          .insert(notificationLog)
          .values({
            workspaceId: preference.workspaceId,
            userId: preference.userId,
            alertEventId: event.id,
            digestBatchId,
            channel: 'email',
            status: 'pending',
            recipientEmail: email,
          })
          .onConflictDoNothing()
          .returning();

        if (inserted) claimedCount++;
      }

      if (claimedCount === 0) {
        log.debug({ userId: preference.userId }, 'All digest events already claimed');
        continue;
      }

      const unsubscribeUrl = `${baseUrl}/api/v1/notifications/unsubscribe?token=${generateUnsubscribeToken(preference.userId!, preference.workspaceId)}`;
      const rendered = await renderDigestEmail(
        events as Parameters<typeof renderDigestEmail>[0],
        rulesMap,
        frequency,
        'en',
        baseUrl,
        unsubscribeUrl
      );

      await boss.send(
        'email-send',
        {
          notificationLogId: digestBatchId,
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
    } catch (err) {
      log.error(
        { error: err instanceof Error ? err.message : String(err), userId: preference.userId },
        `Failed to process ${frequency} digest`
      );
    }
  }

  log.info({ frequency, prefsCount: prefs.length }, 'Digest job completed');
}

// --- Handler registration ---

export async function registerNotificationHandlers(boss: PgBoss): Promise<void> {
  // email-send worker
  await boss.work<EmailSendJobData>(
    'email-send',
    { includeMetadata: true, localConcurrency: 5 },
    async (jobs) => {
      for (const job of jobs) {
        await processEmailSend(job);
      }
    }
  );

  // Digest workers
  await boss.work(
    'email-digest-hourly',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      await processDigest('hourly', 1, new Date(), boss);
    }
  );

  await boss.work(
    'email-digest-daily',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      await processDigest('daily', 24, new Date(), boss);
    }
  );

  await boss.work(
    'email-digest-weekly',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      await processDigest('weekly', 168, new Date(), boss);
    }
  );

  // Schedule cron jobs
  await boss.schedule('email-digest-hourly', '0 * * * *', {});
  await boss.schedule('email-digest-daily', '0 * * * *', {});
  await boss.schedule('email-digest-weekly', '0 * * * *', {});
}
