import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import {
  apiError,
  apiSuccess,
  apiNoContent,
  badRequest,
  forbidden,
  notFound,
} from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import type { RouteContext } from '@/lib/api/types';
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from '@/modules/report-templates/report-template.service';
import { updateTemplateSchema } from '@/modules/report-templates/report-template.types';
import { commitStagingLogo, deleteLogo } from '@/modules/report-templates/template-logo.service';

type Params = { templateId: string };

// GET /api/v1/reports/templates/:templateId
export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req: Request, ctx: RouteContext<Params>) => {
          if (env.QUAYNT_EDITION === 'community') {
            return forbidden('Custom report templates require a commercial edition');
          }

          const auth = getAuthContext(req);
          const { templateId } = await ctx.params;

          const template = await getTemplate(auth.workspaceId, templateId);
          if (!template) return notFound('report_template');

          return apiSuccess({ template });
        }, 'read'),
        { points: 30, duration: 60 }
      )
    )
  )
);

// PATCH /api/v1/reports/templates/:templateId
export const PATCH = withRequestId(
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

          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return badRequest('Invalid JSON body');
          }

          const parsed = updateTemplateSchema.safeParse(body);
          if (!parsed.success) {
            const details = parsed.error.issues.map((i) => ({
              field: i.path.map(String).join('.'),
              message: i.message,
            }));
            return apiError('BAD_REQUEST', 'Invalid template parameters', 400, details);
          }

          const input = parsed.data;

          // Handle logo upload commit
          if (input.branding?.logoUploadId) {
            // Get existing template to check for existing logo
            const existing = await getTemplate(auth.workspaceId, templateId);
            if (!existing) return notFound('report_template');

            // Delete old logo if present
            if (existing.branding.logoPath) {
              await deleteLogo(existing.branding.logoPath);
            }

            const logoPath = await commitStagingLogo(
              auth.workspaceId,
              input.branding.logoUploadId,
              templateId
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- branding field includes logoPath from commit step
            input.branding = { ...input.branding, logoUploadId: undefined, logoPath } as any;
          }

          const template = await updateTemplate(auth.workspaceId, templateId, input);
          if (!template) return notFound('report_template');

          log.info({ templateId }, 'Template updated');
          return apiSuccess({ template });
        }, 'read-write'),
        { points: 30, duration: 60 }
      )
    )
  )
);

// DELETE /api/v1/reports/templates/:templateId
export const DELETE = withRequestId(
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

          const deleted = await deleteTemplate(auth.workspaceId, templateId);
          if (!deleted) return notFound('report_template');

          log.info({ templateId }, 'Template deleted');
          return apiNoContent();
        }, 'read-write'),
        { points: 30, duration: 60 }
      )
    )
  )
);
