import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { rotateWebhookEndpointSecret } from '@/modules/webhooks/webhook.service';

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const { webhookId } = await ctx.params;

          const result = await rotateWebhookEndpointSecret(webhookId, auth.workspaceId);
          if (!result) {
            return notFound(t('resources.webhook'));
          }

          return apiSuccess(result);
        }, 'admin')
      )
    )
  )
);
