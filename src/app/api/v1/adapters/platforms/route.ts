import { withAuth, withScope } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess } from '@/lib/api/response';
import { getAdapterRegistry } from '@/modules/adapters';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async () => {
          const registry = getAdapterRegistry();
          const platforms = registry.getRegisteredPlatforms();
          return apiSuccess(platforms);
        }, 'read')
      )
    )
  )
);
