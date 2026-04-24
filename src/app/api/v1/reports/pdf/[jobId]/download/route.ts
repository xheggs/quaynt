import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { notFound, apiError } from '@/lib/api/response';
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

          // Must be completed
          if (job.status !== 'completed') {
            return apiError('CONFLICT', t('reports.notReady', { status: job.status }), 409);
          }

          // Check file exists
          if (!job.filePath || !existsSync(job.filePath)) {
            return apiError('GONE', t('reports.fileUnavailable'), 410);
          }

          // Read and serve PDF
          const pdfBuffer = readFileSync(job.filePath);
          const filename = `report_${job.id}.pdf`;

          return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': String(pdfBuffer.length),
              'Cache-Control': 'no-store',
            },
          });
        }, 'read'),
        { points: 20, duration: 60 }
      )
    )
  )
);
