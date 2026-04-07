import type { PgBoss } from 'pg-boss';
import { eq, and, lt } from 'drizzle-orm';
import { unlinkSync, existsSync } from 'node:fs';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { reportJob } from './report-job.schema';

const log = logger.child({ module: 'pdf-cleanup' });

const STUCK_JOB_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

async function processCleanup(): Promise<void> {
  const now = new Date();

  // 1. Delete expired PDF files and mark jobs as expired
  const expiredJobs = await db
    .select({ id: reportJob.id, filePath: reportJob.filePath })
    .from(reportJob)
    .where(and(eq(reportJob.status, 'completed'), lt(reportJob.expiresAt, now)));

  let deletedFiles = 0;
  for (const job of expiredJobs) {
    if (job.filePath && existsSync(job.filePath)) {
      try {
        unlinkSync(job.filePath);
        deletedFiles++;
      } catch (err) {
        log.warn(
          { jobId: job.id, filePath: job.filePath, err },
          'Failed to delete expired PDF file'
        );
      }
    }

    await db
      .update(reportJob)
      .set({ status: 'expired', filePath: null })
      .where(eq(reportJob.id, job.id));
  }

  // 2. Fail stuck processing jobs (older than 5 minutes)
  const stuckThreshold = new Date(now.getTime() - STUCK_JOB_THRESHOLD_MS);

  const stuckResult = await db
    .update(reportJob)
    .set({
      status: 'failed',
      errorMessage: 'Generation timed out',
      completedAt: now,
    })
    .where(and(eq(reportJob.status, 'processing'), lt(reportJob.startedAt, stuckThreshold)))
    .returning({ id: reportJob.id });

  const stuckCount = stuckResult.length;

  log.info(
    {
      expiredJobs: expiredJobs.length,
      deletedFiles,
      stuckJobsFailed: stuckCount,
    },
    'PDF cleanup completed'
  );
}

export async function registerPdfCleanupHandler(boss: PgBoss): Promise<void> {
  await boss.work('report-pdf-cleanup', { includeMetadata: true }, async () => {
    await processCleanup();
  });
}
