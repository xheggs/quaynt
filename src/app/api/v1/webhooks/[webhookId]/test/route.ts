import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound, conflict } from '@/lib/api/response';
import { createBoss } from '@/lib/jobs/boss';
import { sendTestEvent } from '@/modules/webhooks/webhook.service';

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { webhookId } = await ctx.params;
          const auth = getAuthContext(req);
          const boss = createBoss();

          try {
            const result = await sendTestEvent(webhookId, auth.workspaceId, boss);
            return apiSuccess({
              eventId: result.eventId,
              deliveryId: result.deliveryIds[0],
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to send test event';
            if (message.includes('not found')) {
              return notFound('Webhook endpoint');
            }
            if (message.includes('disabled')) {
              return conflict(message);
            }
            throw err;
          }
        }, 'admin')
      )
    )
  )
);
