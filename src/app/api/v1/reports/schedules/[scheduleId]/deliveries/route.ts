import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, notFound } from '@/lib/api/response';
import { scheduleIdParamSchema } from '@/modules/scheduled-reports/scheduled-report.types';
import { listDeliveries } from '@/modules/scheduled-reports/scheduled-report.service';

const DELIVERY_ALLOWED_SORTS = ['createdAt', 'deliveredAt'];

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            params: scheduleIdParamSchema,
          });
          if (!validated.success) return validated.response;

          const pagination = parsePagination(req.nextUrl.searchParams, DELIVERY_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const result = await listDeliveries(
            auth.workspaceId,
            validated.data.params.scheduleId,
            pagination
          );

          if (!result) return notFound('Schedule');

          return apiSuccess(
            formatPaginatedResponse(result.items, result.total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
