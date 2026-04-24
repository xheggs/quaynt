import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { listVisits } from '@/modules/traffic/ai-visit.service';

const visitFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  platform: z.string().max(40).optional(),
  source: z.enum(['snippet', 'log']).optional(),
  siteKeyId: z.string().max(40).optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const pagination = parsePagination(req.nextUrl.searchParams, ['visitedAt']);
          if (pagination instanceof NextResponse) return pagination;

          const rawFilters = Object.fromEntries(req.nextUrl.searchParams.entries());
          const filtersParsed = visitFiltersSchema.safeParse(rawFilters);
          if (!filtersParsed.success) return badRequest(t('validation.invalidFilter'));

          const { items, total } = await listVisits(
            auth.workspaceId,
            filtersParsed.data,
            pagination
          );

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
