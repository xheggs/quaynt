import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess } from '@/lib/api/response';
import { getAlertSummary } from '@/modules/alerts/alert.service';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const params = req.nextUrl.searchParams;

          const from = params.get('from') ?? undefined;
          const to = params.get('to') ?? undefined;

          const summary = await getAlertSummary(auth.workspaceId, { from, to });

          return apiSuccess(summary);
        }, 'read')
      )
    )
  )
);
