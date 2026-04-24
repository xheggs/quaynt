import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getTimeSeries } from '@/modules/traffic/traffic-analytics.service';

const schema = z.object({
  from: z.string(),
  to: z.string(),
  platform: z.string().max(40).optional(),
  source: z.enum(['snippet', 'log']).optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
          if (!parsed.success) return badRequest(t('validation.invalidFilter'));

          const points = await getTimeSeries(auth.workspaceId, parsed.data);
          return apiSuccess(points);
        }, 'read')
      )
    )
  )
);
