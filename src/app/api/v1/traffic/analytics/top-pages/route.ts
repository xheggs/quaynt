import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { getTopLandingPages } from '@/modules/traffic/traffic-analytics.service';

const schema = z.object({
  from: z.string(),
  to: z.string(),
  platform: z.string().max(40).optional(),
  source: z.enum(['snippet', 'log']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const parsed = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
          if (!parsed.success) return badRequest('Invalid filter parameters');

          const { limit, ...filters } = parsed.data;
          const auth = getAuthContext(req);
          const rows = await getTopLandingPages(auth.workspaceId, filters, limit);
          return apiSuccess(rows);
        }, 'read')
      )
    )
  )
);
