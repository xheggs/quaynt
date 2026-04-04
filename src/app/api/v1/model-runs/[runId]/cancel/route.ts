import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound, conflict } from '@/lib/api/response';
import { cancelModelRun } from '@/modules/model-runs/model-run.service';

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { runId } = await ctx.params;
          const auth = getAuthContext(req);

          try {
            const result = await cancelModelRun(runId, auth.workspaceId);
            if (!result) {
              return notFound('Model run');
            }
            return apiSuccess(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to cancel model run';
            if (message.includes('already')) {
              return conflict(message);
            }
            return conflict(message);
          }
        }, 'read-write')
      )
    )
  )
);
