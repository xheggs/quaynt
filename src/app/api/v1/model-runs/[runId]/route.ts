import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound } from '@/lib/api/response';
import { getModelRun } from '@/modules/model-runs/model-run.service';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { runId } = await ctx.params;
          const auth = getAuthContext(req);

          const result = await getModelRun(runId, auth.workspaceId);
          if (!result) {
            return notFound('Model run');
          }

          return apiSuccess(result);
        }, 'read')
      )
    )
  )
);
