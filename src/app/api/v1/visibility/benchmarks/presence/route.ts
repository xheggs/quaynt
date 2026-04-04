import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { getPresenceMatrix } from '@/modules/visibility/benchmark.service';

const PRESENCE_ALLOWED_SORTS: string[] = [];

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, PRESENCE_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const params = req.nextUrl.searchParams;

          const promptSetId = params.get('promptSetId');
          if (!promptSetId) {
            return badRequest('A prompt set (market) is required to view competitor benchmarks');
          }

          const rawBrandIds = params.get('brandIds');
          const brandIds = rawBrandIds ? rawBrandIds.split(',').filter(Boolean) : undefined;

          const filters = {
            promptSetId,
            brandIds,
            platformId: params.get('platformId') ?? undefined,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
          };

          const { rows, total } = await getPresenceMatrix(auth.workspaceId, filters, pagination);

          return apiSuccess(
            formatPaginatedResponse(rows, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
