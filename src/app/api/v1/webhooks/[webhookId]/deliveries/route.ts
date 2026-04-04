import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, notFound } from '@/lib/api/response';
import { listDeliveries, WEBHOOK_DELIVERY_ALLOWED_SORTS } from '@/modules/webhooks/webhook.service';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { webhookId } = await ctx.params;
          const pagination = parsePagination(
            req.nextUrl.searchParams,
            WEBHOOK_DELIVERY_ALLOWED_SORTS
          );
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);

          try {
            const { items, total } = await listDeliveries(webhookId, auth.workspaceId, pagination);

            return apiSuccess(
              formatPaginatedResponse(items, total, pagination.page, pagination.limit)
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : '';
            if (message.includes('not found')) {
              return notFound('Webhook endpoint');
            }
            throw err;
          }
        }, 'read')
      )
    )
  )
);
