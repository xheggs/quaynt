import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiNoContent, notFound, unprocessable } from '@/lib/api/response';
import {
  getWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
} from '@/modules/webhooks/webhook.service';

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  description: z.string().max(255).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { webhookId } = await ctx.params;
          const auth = getAuthContext(req);

          const endpoint = await getWebhookEndpoint(webhookId, auth.workspaceId);
          if (!endpoint) {
            return notFound('Webhook endpoint');
          }

          return apiSuccess(endpoint);
        }, 'read')
      )
    )
  )
);

export const PUT = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { webhookId } = await ctx.params;
          const validated = await validateRequest(req, ctx, {
            body: updateWebhookSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const updated = await updateWebhookEndpoint(
              webhookId,
              auth.workspaceId,
              validated.data.body
            );
            if (!updated) {
              return notFound('Webhook endpoint');
            }
            return apiSuccess(updated);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update webhook';
            return unprocessable([{ field: 'url', message }]);
          }
        }, 'admin')
      )
    )
  )
);

export const DELETE = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { webhookId } = await ctx.params;
          const auth = getAuthContext(req);

          const deleted = await deleteWebhookEndpoint(webhookId, auth.workspaceId);
          if (!deleted) {
            return notFound('Webhook endpoint');
          }

          return apiNoContent();
        }, 'admin')
      )
    )
  )
);
