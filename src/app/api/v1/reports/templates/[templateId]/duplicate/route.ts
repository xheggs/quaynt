import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiCreated, apiError, forbidden } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getRequestLogger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import type { RouteContext } from '@/lib/api/types';
import {
  duplicateTemplate,
  TemplateLimitError,
  TemplateNotFoundError,
} from '@/modules/report-templates/report-template.service';

type Params = { templateId: string };

// POST /api/v1/reports/templates/:templateId/duplicate
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req: Request, ctx: RouteContext<Params>) => {
          const t = await apiErrors();
          if (env.QUAYNT_EDITION === 'community') {
            return forbidden(t('reports.templatesCommercial'));
          }

          const auth = getAuthContext(req);
          const log = getRequestLogger(req);
          const { templateId } = await ctx.params;
          const createdBy = auth.method === 'session' ? auth.userId : auth.apiKeyId;

          try {
            const template = await duplicateTemplate(auth.workspaceId, templateId, createdBy);

            log.info({ templateId: template.id, sourceId: templateId }, 'Template duplicated');
            return apiCreated({ template });
          } catch (err) {
            if (err instanceof TemplateNotFoundError) {
              return apiError('NOT_FOUND', t('resources.reportTemplate'), 404);
            }
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
