import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiNoContent, forbidden, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getRequestLogger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import type { RouteContext } from '@/lib/api/types';
import { getTemplate, updateTemplate } from '@/modules/report-templates/report-template.service';
import { deleteLogo } from '@/modules/report-templates/template-logo.service';

type Params = { templateId: string };

// DELETE /api/v1/reports/templates/:templateId/logo — remove logo
export const DELETE = withRequestId(
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

          const template = await getTemplate(auth.workspaceId, templateId);
          if (!template) return notFound(t('resources.reportTemplate'));

          // Delete file from disk
          if (template.branding.logoPath) {
            await deleteLogo(template.branding.logoPath);
          }

          // Clear logoPath from branding
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripping logoPath to clear it
          const { logoPath: _removedPath, ...brandingWithoutLogo } = template.branding;
          await updateTemplate(auth.workspaceId, templateId, {
            branding: brandingWithoutLogo,
          });

          log.info({ templateId }, 'Logo removed from template');
          return apiNoContent();
        }, 'read-write'),
        { points: 10, duration: 60 }
      )
    )
  )
);
