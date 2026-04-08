import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiNoContent, notFound } from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import {
  scheduleIdParamSchema,
  updateScheduleSchema,
} from '@/modules/scheduled-reports/scheduled-report.types';
import {
  getSchedule,
  updateSchedule,
  deleteSchedule,
} from '@/modules/scheduled-reports/scheduled-report.service';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            params: scheduleIdParamSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const schedule = await getSchedule(auth.workspaceId, validated.data.params.scheduleId);

          if (!schedule) return notFound('Schedule');

          return apiSuccess(schedule);
        }, 'read')
      )
    )
  )
);

export const PATCH = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            params: scheduleIdParamSchema,
            body: updateScheduleSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const log = getRequestLogger(req);

          const result = await updateSchedule(
            auth.workspaceId,
            validated.data.params.scheduleId,
            validated.data.body
          );

          if (!result) return notFound('Schedule');

          log.info({ scheduleId: validated.data.params.scheduleId }, 'Report schedule updated');
          return apiSuccess(result);
        }, 'read-write')
      )
    )
  )
);

export const DELETE = withRequestId(
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

          const deleted = await deleteSchedule(auth.workspaceId, validated.data.params.scheduleId);
          if (!deleted) return notFound('Schedule');

          log.info({ scheduleId: validated.data.params.scheduleId }, 'Report schedule deleted');
          return apiNoContent();
        }, 'read-write')
      )
    )
  )
);
