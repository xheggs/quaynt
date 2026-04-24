import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, apiNoContent, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getApiKey, revokeApiKey } from '@/modules/workspace/api-key.service';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { keyId } = await ctx.params;
          const auth = getAuthContext(req);
          const t = await apiErrors();

          const key = await getApiKey(keyId, auth.workspaceId);
          if (!key) {
            return notFound(t('resources.apiKey'));
          }

          return apiSuccess(key);
        }, 'read')
      )
    )
  )
);

export const DELETE = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { keyId } = await ctx.params;
          const auth = getAuthContext(req);
          const t = await apiErrors();

          const revoked = await revokeApiKey(keyId, auth.workspaceId);
          if (!revoked) {
            return notFound(t('resources.apiKey'));
          }

          return apiNoContent();
        }, 'admin')
      )
    )
  )
);
