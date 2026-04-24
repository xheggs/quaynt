import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiCreated, apiError, badRequest, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getRequestLogger } from '@/lib/logger';
import { db } from '@/lib/db';
import { createBoss } from '@/lib/jobs/boss';
import { reportJob } from '@/modules/pdf/report-job.schema';
import type { ReportJobScope } from '@/modules/pdf/report-job.schema';
import { pdfReportRequestSchema } from '@/modules/pdf/pdf.types';
import type { ReportPdfJobData } from '@/modules/pdf/pdf.types';
import { getWorkspaceById } from '@/modules/workspace/workspace.service';
import { getTemplate } from '@/modules/report-templates/report-template.service';

const MAX_BRANDS = 25;
const EXPIRY_DAYS = 30;

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const log = getRequestLogger(req);

          // Parse and validate body
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return badRequest(t('validation.invalidJson'));
          }

          const parsed = pdfReportRequestSchema.safeParse(body);
          if (!parsed.success) {
            const details = parsed.error.issues.map((i) => ({
              field: i.path.map(String).join('.'),
              message: i.message,
            }));
            return apiError('BAD_REQUEST', t('reports.invalidParams'), 400, details);
          }

          const params = parsed.data;

          // Resolve brand IDs
          const rawBrandIds = params.brandIds
            ? params.brandIds.split(',').filter(Boolean)
            : undefined;
          const brandIds = rawBrandIds ?? (params.brandId ? [params.brandId] : undefined);

          if (!brandIds || brandIds.length === 0) {
            return badRequest(t('visibility.brandsRequired'));
          }

          if (brandIds.length > MAX_BRANDS) {
            return badRequest(t('reports.maxBrands', { max: MAX_BRANDS }));
          }

          // Validate template if provided
          if (params.templateId) {
            const template = await getTemplate(auth.workspaceId, params.templateId);
            if (!template) {
              return notFound(t('resources.reportTemplate'));
            }
          }

          // Build scope for job
          const scope: ReportJobScope = {
            promptSetId: params.promptSetId,
            brandIds,
            from: params.from,
            to: params.to,
            comparisonPeriod: params.comparisonPeriod,
            metrics: params.metrics ? params.metrics.split(',').filter(Boolean) : undefined,
            platformId: params.platformId,
            locale: params.locale,
            templateId: params.templateId,
          };

          // Use pg-boss singletonKey for deduplication (prevents identical jobs within 5 min)
          const scopeJson = JSON.stringify(scope);
          const singletonKey = `pdf-${auth.workspaceId}-${scopeJson}`;

          // Get workspace name for the report cover
          const ws = await getWorkspaceById(auth.workspaceId);
          const workspaceName = ws?.name ?? 'Workspace';

          // Create report job record
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

          const createdBy = auth.method === 'session' ? auth.userId : auth.apiKeyId;

          const [job] = await db
            .insert(reportJob)
            .values({
              workspaceId: auth.workspaceId,
              createdBy,
              status: 'pending',
              scope,
              locale: params.locale ?? 'en',
              expiresAt,
            })
            .returning({ id: reportJob.id });

          // Enqueue pg-boss job
          const boss = createBoss();
          const jobData: ReportPdfJobData = {
            jobId: job.id,
            workspaceId: auth.workspaceId,
            workspaceName,
            scope,
            locale: params.locale ?? 'en',
            templateId: params.templateId,
          };

          await boss.send('report-pdf-generate', jobData, {
            retryLimit: 3,
            expireInSeconds: 60,
            singletonKey,
            singletonSeconds: 300, // Prevent duplicate jobs for 5 minutes
          });

          log.info({ jobId: job.id }, 'PDF generation job created');

          return apiCreated({ jobId: job.id, status: 'pending' });
        }, 'read'),
        { points: 5, duration: 60 }
      )
    )
  )
);
