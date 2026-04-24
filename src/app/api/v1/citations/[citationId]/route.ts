import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getCitation } from '@/modules/citations/citation.service';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { citationId } = await ctx.params;
          const auth = getAuthContext(req);
          const t = await apiErrors();

          try {
            const result = await getCitation(citationId, auth.workspaceId);
            return apiSuccess(result);
          } catch {
            return notFound(t('resources.citation'));
          }
        }, 'read')
      )
    )
  )
);
