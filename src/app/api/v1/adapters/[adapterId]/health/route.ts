import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound, apiError } from '@/lib/api/response';
import { getAdapterHealth } from '@/modules/adapters/adapter.service';
import { getAdapterRegistry } from '@/modules/adapters';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { adapterId } = await ctx.params;
          const auth = getAuthContext(req);
          const registry = getAdapterRegistry();

          try {
            const health = await getAdapterHealth(adapterId, auth.workspaceId, registry);

            if (!health) {
              return notFound('Adapter');
            }

            return apiSuccess(health);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Health check failed';
            return apiError('HEALTH_CHECK_FAILED', message, 500);
          }
        }, 'read')
      )
    )
  )
);
