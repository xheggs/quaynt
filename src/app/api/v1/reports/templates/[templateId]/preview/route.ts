import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiCreated, forbidden, notFound } from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import { db } from '@/lib/db';
import { createBoss } from '@/lib/jobs/boss';
import type { RouteContext } from '@/lib/api/types';
import { reportJob } from '@/modules/pdf/report-job.schema';
import type { ReportJobScope } from '@/modules/pdf/report-job.schema';
import type { ReportPdfJobData } from '@/modules/pdf/pdf.types';
import { getTemplate } from '@/modules/report-templates/report-template.service';
import { getWorkspaceById } from '@/modules/workspace/workspace.service';

type Params = { templateId: string };

const EXPIRY_DAYS = 1; // Preview PDFs expire quickly

// POST /api/v1/reports/templates/:templateId/preview
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req: Request, ctx: RouteContext<Params>) => {
          if (env.QUAYNT_EDITION === 'community') {
            return forbidden('Custom report templates require a commercial edition');
          }

          const auth = getAuthContext(req);
          const log = getRequestLogger(req);
          const { templateId } = await ctx.params;

          // Verify template exists and belongs to workspace
          const template = await getTemplate(auth.workspaceId, templateId);
          if (!template) return notFound('report_template');

          // Get workspace info
          const ws = await getWorkspaceById(auth.workspaceId);
          const workspaceName = ws?.name ?? 'Workspace';

          // Build preview scope — uses workspace's first brand and last 30 days
          const to = new Date().toISOString().slice(0, 10);
          const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

          // Parse optional body for specific promptSetId/brandIds
          let promptSetId = '';
          let brandIds: string[] = [];
          try {
            const body = await req.json();
            if (body.promptSetId) promptSetId = body.promptSetId;
            if (body.brandIds) brandIds = body.brandIds;
            if (body.brandId) brandIds = [body.brandId];
          } catch {
            // Body is optional for preview
          }

          // If no promptSetId provided, we need one for the scope
          // The handler will deal with empty data by generating sample data
          if (!promptSetId) {
            promptSetId = 'preview';
          }

          const scope: ReportJobScope = {
            promptSetId,
            brandIds: brandIds.length > 0 ? brandIds : ['preview'],
            from,
            to,
            templateId,
          };

          const createdBy = auth.method === 'session' ? auth.userId : auth.apiKeyId;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

          const [job] = await db
            .insert(reportJob)
            .values({
              workspaceId: auth.workspaceId,
              createdBy,
              status: 'pending',
              scope,
              locale: 'en',
              expiresAt,
            })
            .returning({ id: reportJob.id });

          // Enqueue generation job
          const boss = createBoss();
          const jobData: ReportPdfJobData = {
            jobId: job.id,
            workspaceId: auth.workspaceId,
            workspaceName,
            scope,
            locale: 'en',
            templateId,
          };

          await boss.send('report-pdf-generate', jobData, {
            retryLimit: 1,
            expireInSeconds: 60,
          });

          log.info({ jobId: job.id, templateId }, 'Template preview job created');
          return apiCreated({ jobId: job.id, status: 'pending' });
        }, 'read'),
        { points: 10, duration: 60 }
      )
    )
  )
);
