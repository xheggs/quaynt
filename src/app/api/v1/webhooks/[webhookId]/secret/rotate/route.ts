import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound } from '@/lib/api/response';
import { rotateWebhookEndpointSecret } from '@/modules/webhooks/webhook.service';

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { webhookId } = await ctx.params;
          const auth = getAuthContext(req);

          const result = await rotateWebhookEndpointSecret(webhookId, auth.workspaceId);
          if (!result) {
            return notFound('Webhook endpoint');
          }

          return apiSuccess(result);
        }, 'admin')
      )
    )
  )
);
