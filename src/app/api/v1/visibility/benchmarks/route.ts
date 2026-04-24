import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getBenchmarks } from '@/modules/visibility/benchmark.service';

const comparisonPeriodEnum = z.enum(['previous_period', 'previous_week', 'previous_month']);

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const params = req.nextUrl.searchParams;

          const promptSetId = params.get('promptSetId');
          if (!promptSetId) {
            return badRequest(
              t('visibility.promptSetRequired', { scope: 'competitor benchmarks' })
            );
          }

          const rawComparisonPeriod = params.get('comparisonPeriod');
          if (rawComparisonPeriod) {
            const parsed = comparisonPeriodEnum.safeParse(rawComparisonPeriod);
            if (!parsed.success) {
              return badRequest(t('reports.invalidComparisonPeriod'));
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
