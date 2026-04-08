import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, notFound } from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import { createBoss } from '@/lib/jobs/boss';
import { scheduleIdParamSchema } from '@/modules/scheduled-reports/scheduled-report.types';
import { triggerSchedule, getSchedule } from '@/modules/scheduled-reports/scheduled-report.service';

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            params: scheduleIdParamSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const log = getRequestLogger(req);
          const boss = createBoss();

          const triggered = await triggerSchedule(
            auth.workspaceId,
            validated.data.params.scheduleId,
            boss
          );

          if (!triggered) return notFound('Schedule');

          const schedule = await getSchedule(auth.workspaceId, validated.data.params.scheduleId);

          log.info(
            { scheduleId: validated.data.params.scheduleId },
            'Report schedule manually triggered'
          );

          return apiSuccess({
            message: 'Schedule triggered',
            nextDelivery: schedule?.nextRunAt?.toISOString() ?? null,
          });
        }, 'read-write'),
        { points: 5, duration: 60 }
      )
    )
  )
);
