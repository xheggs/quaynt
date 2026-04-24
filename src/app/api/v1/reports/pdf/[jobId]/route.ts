import { eq, and } from 'drizzle-orm';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound, apiError } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { db } from '@/lib/db';
import { reportJob } from '@/modules/pdf/report-job.schema';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, { params }: { params: Promise<{ jobId: string }> }) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const { jobId } = await params;

          const [job] = await db
            .select()
            .from(reportJob)
            .where(and(eq(reportJob.id, jobId), eq(reportJob.workspaceId, auth.workspaceId)))
            .limit(1);

          if (!job) {
            return notFound(t('resources.report'));
          }

          // Check if expired
          if (
            job.status === 'expired' ||
            (job.expiresAt && job.expiresAt < new Date() && job.status === 'completed')
          ) {
            return apiError('GONE', t('reports.expired'), 410);
          }

          if (job.status === 'completed') {
            return apiSuccess({
              jobId: job.id,
              status: 'completed',
              downloadUrl: `/api/v1/reports/pdf/${job.id}/download`,
              fileSizeBytes: job.fileSizeBytes,
              pageCount: job.pageCount,
              completedAt: job.completedAt?.toISOString(),
            });
          }

          if (job.status === 'failed') {
            return apiSuccess({
              jobId: job.id,
              status: 'failed',
              error: job.errorMessage,
            });
          }

          // Pending or processing
          return apiSuccess({
            jobId: job.id,
            status: job.status,
            createdAt: job.createdAt.toISOString(),
            startedAt: job.startedAt?.toISOString() ?? null,
          });
        }, 'read'),
        { points: 20, duration: 60 }
      )
    )
  )
);
