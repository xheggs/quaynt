import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, apiCreated, conflict, unprocessable } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { WEBHOOK_EVENT_TYPES } from '@/modules/webhooks/webhook.events';
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  WEBHOOK_ENDPOINT_ALLOWED_SORTS,
} from '@/modules/webhooks/webhook.service';

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  description: z.string().max(255).optional(),
});

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            body: createWebhookSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const t = await apiErrors();

          // Validate event types
          for (const event of validated.data.body.events) {
            if (event !== '*' && !(WEBHOOK_EVENT_TYPES as readonly string[]).includes(event)) {
              return unprocessable([
                { field: 'events', message: t('webhook.eventInvalid', { event }) },
              ]);
            }
          }

          try {
            const result = await createWebhookEndpoint(auth.workspaceId, validated.data.body);
            return apiCreated(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create webhook';
            if (message.includes('Maximum number')) {
              return conflict(message);
            }
            return unprocessable([{ field: 'url', message }]);
          }
        }, 'admin')
      )
    )
  )
);

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(
            req.nextUrl.searchParams,
            WEBHOOK_ENDPOINT_ALLOWED_SORTS
          );
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const { items, total } = await listWebhookEndpoints(auth.workspaceId, pagination);

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
