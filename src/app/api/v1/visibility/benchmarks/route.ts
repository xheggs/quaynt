import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { getBenchmarks } from '@/modules/visibility/benchmark.service';

const comparisonPeriodEnum = z.enum(['previous_period', 'previous_week', 'previous_month']);

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const params = req.nextUrl.searchParams;

          const promptSetId = params.get('promptSetId');
          if (!promptSetId) {
            return badRequest('A prompt set (market) is required to view competitor benchmarks');
          }

          const rawComparisonPeriod = params.get('comparisonPeriod');
          if (rawComparisonPeriod) {
            const parsed = comparisonPeriodEnum.safeParse(rawComparisonPeriod);
            if (!parsed.success) {
              return badRequest(
                "comparisonPeriod must be 'previous_period', 'previous_week', or 'previous_month'"
              );
            }
          }

          const rawBrandIds = params.get('brandIds');
          const brandIds = rawBrandIds ? rawBrandIds.split(',').filter(Boolean) : undefined;

          const filters = {
            promptSetId,
            platformId: params.get('platformId') ?? undefined,
            locale: params.get('locale') ?? undefined,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
            brandIds,
            comparisonPeriod:
              (rawComparisonPeriod as 'previous_period' | 'previous_week' | 'previous_month') ??
              undefined,
          };

          const result = await getBenchmarks(auth.workspaceId, filters);

          return apiSuccess(result);
        }, 'read')
      )
    )
  )
);
