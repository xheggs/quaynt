import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import {
  getPositionAggregates,
  POSITION_AGGREGATE_ALLOWED_SORTS,
} from '@/modules/visibility/position-aggregate.service';

const granularityEnum = z.enum(['day', 'week', 'month']);

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(
            req.nextUrl.searchParams,
            POSITION_AGGREGATE_ALLOWED_SORTS
          );
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const t = await apiErrors();
          const params = req.nextUrl.searchParams;

          const promptSetId = params.get('promptSetId');
          if (!promptSetId) {
            return badRequest(t('visibility.promptSetRequired', { scope: 'position data' }));
          }

          const rawGranularity = params.get('granularity');
          if (rawGranularity) {
            const parsed = granularityEnum.safeParse(rawGranularity);
            if (!parsed.success) {
              return badRequest(t('validation.invalidGranularity'));
            }
          }

          const filters = {
            promptSetId,
            brandId: params.get('brandId') ?? undefined,
            platformId: params.get('platformId') ?? undefined,
            locale: params.get('locale') ?? undefined,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
            granularity: (rawGranularity as 'day' | 'week' | 'month') ?? undefined,
          };

          const { items, total, summary } = await getPositionAggregates(
            auth.workspaceId,
            filters,
            pagination
          );

          return apiSuccess({
            ...formatPaginatedResponse(items, total, pagination.page, pagination.limit),
            summary,
          });
        }, 'read')
      )
    )
  )
);
