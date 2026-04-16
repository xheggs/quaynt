import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess } from '@/lib/api/response';
import { getTimeSeries } from '@/modules/crawler/crawler-analytics.service';
import type { BotCategory } from '@/modules/crawler/crawler.types';

// GET /api/v1/crawler/analytics/timeseries — daily time series
export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const url = new URL(req.url);

          const filters = {
            from: url.searchParams.get('from') ?? '',
            to: url.searchParams.get('to') ?? '',
            botName: url.searchParams.get('botName') ?? undefined,
            botCategory: (url.searchParams.get('botCategory') as BotCategory) ?? undefined,
          };

          const series = await getTimeSeries(auth.workspaceId, filters);
          return apiSuccess(series);
        }, 'read')
      )
    )
  )
);
