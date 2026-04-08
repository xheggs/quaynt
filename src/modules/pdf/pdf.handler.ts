import type { PgBoss, JobWithMetadata } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { reportJob } from './report-job.schema';
import { generatePdfReport } from './pdf-generator.service';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';
import type { ReportPdfJobData } from './pdf.types';
import { PdfPermanentError } from './pdf.types';

const log = logger.child({ module: 'pdf-handler' });

async function processReportPdfJob(
  job: JobWithMetadata<ReportPdfJobData>,
  boss: PgBoss
): Promise<void> {
  const { jobId, workspaceId, workspaceName, scope, locale } = job.data;

  const jobLog = log.child({ jobId, workspaceId });
  jobLog.info('Processing PDF generation job');

  // Update status to processing
  await db
    .update(reportJob)
    .set({ status: 'processing', startedAt: new Date() })
    .where(eq(reportJob.id, jobId));

  try {
    const result = await generatePdfReport({
      jobId,
      workspaceId,
      workspaceName,
      scope,
      locale,
      storagePath: env.REPORT_STORAGE_PATH,
      templateId: job.data.templateId,
    });

    // Success: update job record
    await db
      .update(reportJob)
      .set({
        status: 'completed',
        filePath: result.filePath,
        fileSizeBytes: result.fileSizeBytes,
        pageCount: result.pageCount,
        completedAt: new Date(),
      })
      .where(eq(reportJob.id, jobId));

    // Fire webhook
    await dispatchWebhookEvent(
      workspaceId,
      'report.generated',
      {
        report: {
          id: jobId,
          name: 'AI Visibility Report',
          type: 'pdf',
          period: { from: scope.from, to: scope.to },
          generatedAt: new Date().toISOString(),
          downloadUrl: `/api/v1/reports/pdf/${jobId}/download`,
          fileSizeBytes: result.fileSizeBytes,
          pageCount: result.pageCount,
        },
      },
      boss
    );

    jobLog.info(
      { fileSizeBytes: result.fileSizeBytes, pageCount: result.pageCount },
      'PDF generation completed'
    );
  } catch (err) {
    const errorMessage = (err as Error).message;

    if (err instanceof PdfPermanentError) {
      // Permanent failure — don't retry
      await db
        .update(reportJob)
        .set({
          status: 'failed',
          errorMessage,
          completedAt: new Date(),
        })
        .where(eq(reportJob.id, jobId));

      jobLog.error({ error: errorMessage }, 'PDF generation permanently failed');
      return; // Don't throw — prevents pg-boss retry
    }

    // Transient failure — update error message but throw to retry
    await db.update(reportJob).set({ errorMessage }).where(eq(reportJob.id, jobId));

    jobLog.warn({ error: errorMessage }, 'PDF generation failed, retrying');
    throw err; // Triggers pg-boss retry
  }
}

export async function registerPdfHandlers(boss: PgBoss): Promise<void> {
  await boss.work<ReportPdfJobData>(
    'report-pdf-generate',
    {
      includeMetadata: true,
      localConcurrency: 2,
    },
    async (jobs) => {
      for (const job of jobs) {
        await processReportPdfJob(job, boss);
      }
    }
  );

  // Register cleanup schedule — runs daily at 3 AM
  await boss.schedule(
    'report-pdf-cleanup',
    '0 3 * * *',
    {},
    {
      retryLimit: 1,
    }
  );

  const { registerPdfCleanupHandler } = await import('./pdf-cleanup.handler');
  await registerPdfCleanupHandler(boss);

  log.info('PDF handlers registered');
}
