import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiCreated, apiError, apiSuccess, badRequest, forbidden } from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import {
  createTemplate,
  listTemplates,
  TemplateLimitError,
} from '@/modules/report-templates/report-template.service';
import { createTemplateSchema } from '@/modules/report-templates/report-template.types';
import { commitStagingLogo } from '@/modules/report-templates/template-logo.service';

// GET /api/v1/reports/templates — list templates
export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          if (env.QUAYNT_EDITION === 'community') {
            return forbidden('Custom report templates require a commercial edition');
          }

          const auth = getAuthContext(req);
          const templates = await listTemplates(auth.workspaceId);
          return apiSuccess({ templates });
        }, 'read'),
        { points: 30, duration: 60 }
      )
    )
  )
);

// POST /api/v1/reports/templates — create template
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          if (env.QUAYNT_EDITION === 'community') {
            return forbidden('Custom report templates require a commercial edition');
          }

          const auth = getAuthContext(req);
          const log = getRequestLogger(req);

          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return badRequest('Invalid JSON body');
          }

          const parsed = createTemplateSchema.safeParse(body);
          if (!parsed.success) {
            const details = parsed.error.issues.map((i) => ({
              field: i.path.map(String).join('.'),
              message: i.message,
            }));
            return apiError('BAD_REQUEST', 'Invalid template parameters', 400, details);
          }

          const input = parsed.data;
          const createdBy = auth.method === 'session' ? auth.userId : auth.apiKeyId;

          try {
            const template = await createTemplate(auth.workspaceId, createdBy, input);

            // Commit logo from staging if logoUploadId provided
            if (input.branding?.logoUploadId) {
              const logoPath = await commitStagingLogo(
                auth.workspaceId,
                input.branding.logoUploadId,
                template.id
              );
              // Update template with committed logo path
              const { updateTemplate } =
                await import('@/modules/report-templates/report-template.service');
              const updated = await updateTemplate(auth.workspaceId, template.id, {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- branding field includes logoPath from commit step
                branding: { ...input.branding, logoUploadId: undefined, logoPath } as any,
              });
              if (updated) {
                log.info({ templateId: template.id }, 'Template created with logo');
                return apiCreated({ template: updated });
              }
            }

            log.info({ templateId: template.id }, 'Template created');
            return apiCreated({ template });
          } catch (err) {
            if (err instanceof TemplateLimitError) {
              return apiError('TEMPLATE_LIMIT', err.message, 422, { limit: err.limit });
            }
            throw err;
          }
        }, 'read-write'),
        { points: 30, duration: 60 }
      )
    )
  )
);
