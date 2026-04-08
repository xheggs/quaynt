import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { eq, lt } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { generatePrefixedId } from '@/lib/db/id';
import { reportSchedule, reportDelivery } from './scheduled-report.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import { createEmailTransport } from '@/modules/notifications/email/email.transport';
import {
  getDueSchedules,
  advanceScheduleNextRun,
  markScheduleSuccess,
  markScheduleFailure,
  getActiveRecipients,
} from './scheduled-report.service';
import { computeReportPeriod } from './scheduled-report.scheduling';
import {
  generatePdfForSchedule,
  generateExportFile,
  deliverByEmail,
} from './scheduled-report.delivery';
import type { ScheduledReportJobData, ScheduleScope } from './scheduled-report.types';
import { SchedulePermanentError, PERMANENT_ERROR_CODES } from './scheduled-report.types';
import { getWorkspaceById } from '@/modules/workspace/workspace.service';

const log = logger.child({ module: 'scheduled-report-handler' });

// --- Tick job: find due schedules and enqueue generation ---

async function processScheduledReportTick(boss: PgBoss): Promise<void> {
  const dueSchedules = await getDueSchedules();

  if (dueSchedules.length === 0) {
    log.debug('No scheduled reports due');
    return;
  }

  log.info({ count: dueSchedules.length }, 'Processing due scheduled reports');

  for (const schedule of dueSchedules) {
    try {
      await advanceScheduleNextRun(schedule.id);

      const jobData: ScheduledReportJobData = {
        scheduleId: schedule.id,
        workspaceId: schedule.workspaceId,
      };

      await boss.send('scheduled-report-generate', jobData, {
        retryLimit: 3,
        retryDelay: 60,
        retryBackoff: true,
        expireInSeconds: 3600,
        singletonKey: `sched_${schedule.id}`,
        singletonSeconds: 3600,
      });

      log.info({ scheduleId: schedule.id, name: schedule.name }, 'Enqueued scheduled report');
    } catch (err) {
      log.error(
        { scheduleId: schedule.id, error: (err as Error).message },
        'Failed to enqueue scheduled report'
      );
    }
  }
}

// --- Generate job: create report and deliver ---

async function processScheduledReportGenerate(
  data: ScheduledReportJobData,
  boss: PgBoss
): Promise<void> {
  const { scheduleId, workspaceId } = data;
  const jobLog = log.child({ scheduleId, workspaceId });

  const [schedule] = await db
    .select()
    .from(reportSchedule)
    .where(eq(reportSchedule.id, scheduleId))
    .limit(1);

  if (!schedule || !schedule.enabled || schedule.deletedAt) {
    jobLog.info('Schedule disabled or deleted, skipping');
    return;
  }

  const scope = schedule.scope as ScheduleScope;
  const { from, to } = computeReportPeriod(scope);
  const locale = scope.locale ?? 'en';
  const baseUrl = env.BETTER_AUTH_URL;

  try {
    const ws = await getWorkspaceById(workspaceId);
    const workspaceName = ws?.name ?? 'Workspace';

    let reportFilePath: string | null = null;
    let reportJobId: string | null = null;
    let fileSizeBytes = 0;

    if (schedule.format === 'pdf') {
      const result = await generatePdfForSchedule(
        workspaceId,
        workspaceName,
        scope,
        from,
        to,
        locale
      );
      reportFilePath = result.filePath;
      reportJobId = result.jobId;
      fileSizeBytes = result.fileSizeBytes;
    } else {
      const result = await generateExportFile(
        workspaceId,
        scope,
        from,
        to,
        schedule.format,
        schedule.id
      );
      reportFilePath = result.filePath;
      fileSizeBytes = result.fileSizeBytes;
    }

    const recipients = await getActiveRecipients(scheduleId);
    if (recipients.length === 0) {
      jobLog.info('No active recipients, skipping delivery');
      await markScheduleSuccess(scheduleId);
      return;
    }

    const transport = createEmailTransport();

    for (const recipient of recipients) {
      const deliveryId = generatePrefixedId('reportDelivery');

      await db.insert(reportDelivery).values({
        id: deliveryId,
        scheduleId,
        workspaceId,
        reportJobId,
        recipientId: recipient.id,
        format: schedule.format,
        filePath: reportFilePath,
        status: 'pending',
      });

      try {
        if (recipient.type === 'email' && transport) {
          await deliverByEmail(
            boss,
            schedule,
            recipient,
            reportFilePath,
            fileSizeBytes,
            from,
            to,
            locale,
            baseUrl,
            deliveryId
          );
        } else if (recipient.type === 'webhook') {
          await dispatchWebhookEvent(
            workspaceId,
            'report.generated',
            {
              report: {
                id: reportJobId ?? deliveryId,
                name: schedule.name,
                type: schedule.format,
                period: { from, to },
                generatedAt: new Date().toISOString(),
                downloadUrl: reportJobId ? `/api/v1/reports/pdf/${reportJobId}/download` : null,
                scheduleName: schedule.name,
              },
            },
            boss
          );
        }

        await db
          .update(reportDelivery)
          .set({ status: 'delivered', deliveredAt: new Date() })
          .where(eq(reportDelivery.id, deliveryId));
      } catch (err) {
        await db
          .update(reportDelivery)
          .set({ status: 'failed', errorMessage: (err as Error).message })
          .where(eq(reportDelivery.id, deliveryId));

        jobLog.error(
          { recipientId: recipient.id, error: (err as Error).message },
          'Failed to deliver to recipient'
        );
      }
    }

    await dispatchWebhookEvent(
      workspaceId,
      'report_schedule.delivered',
      {
        schedule: {
          id: scheduleId,
          name: schedule.name,
          frequency: schedule.frequency,
          format: schedule.format,
        },
        period: { from, to },
        deliveredAt: new Date().toISOString(),
        recipientCount: recipients.length,
        reportDownloadUrl: reportJobId ? `/api/v1/reports/pdf/${reportJobId}/download` : null,
      },
      boss
    );

    await markScheduleSuccess(scheduleId);
    jobLog.info(
      { format: schedule.format, recipients: recipients.length },
      'Scheduled report delivered'
    );
  } catch (err) {
    const errorMessage = (err as Error).message;
    const isPermanent =
      err instanceof SchedulePermanentError || PERMANENT_ERROR_CODES.has(errorMessage);

    const { failures, autoDisabled } = await markScheduleFailure(scheduleId, errorMessage);

    if (isPermanent || autoDisabled) {
      await dispatchWebhookEvent(
        workspaceId,
        'report_schedule.failed',
        {
          schedule: {
            id: scheduleId,
            name: schedule.name,
            frequency: schedule.frequency,
            format: schedule.format,
          },
          period: { from, to },
          error: errorMessage,
          consecutiveFailures: failures,
          autoDisabled,
        },
        boss
      );
    }

    if (isPermanent) {
      jobLog.error({ error: errorMessage }, 'Scheduled report permanently failed');
      return;
    }

    jobLog.warn({ error: errorMessage, failures }, 'Scheduled report failed');
  }
}

// --- Cleanup job ---

async function processScheduledReportCleanup(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const deleted = await db
    .delete(reportDelivery)
    .where(lt(reportDelivery.createdAt, ninetyDaysAgo))
    .returning({ id: reportDelivery.id });

  const scheduledDir = join(env.REPORT_STORAGE_PATH, 'scheduled');
  try {
    const files = await fs.readdir(scheduledDir);
    let removedFiles = 0;
    for (const file of files) {
      const filePath = join(scheduledDir, file);
      const stat = await fs.stat(filePath);
      if (stat.mtime < thirtyDaysAgo) {
        await fs.unlink(filePath);
        removedFiles++;
      }
    }
    log.info(
      { deliveryRecords: deleted.length, files: removedFiles },
      'Scheduled report cleanup completed'
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error({ error: (err as Error).message }, 'Failed to clean up scheduled report files');
    }
  }
}

// --- Handler registration ---

export async function registerScheduledReportHandlers(boss: PgBoss): Promise<void> {
  await boss.work(
    'scheduled-report-tick',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      await processScheduledReportTick(boss);
    }
  );

  await boss.work<ScheduledReportJobData>(
    'scheduled-report-generate',
    {
      includeMetadata: true,
      localConcurrency: 2,
    },
    async (jobs) => {
      for (const job of jobs) {
        await processScheduledReportGenerate(job.data, boss);
      }
    }
  );

  await boss.work(
    'scheduled-report-cleanup',
    { includeMetadata: true, localConcurrency: 1 },
    async () => {
      await processScheduledReportCleanup();
    }
  );

  await boss.schedule('scheduled-report-tick', '0 * * * *', {}, { retryLimit: 1 });
  await boss.schedule('scheduled-report-cleanup', '0 4 * * *', {}, { retryLimit: 1 });

  log.info('Scheduled report handlers registered');
}
