import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { createBoss } from '@/lib/jobs/boss';
import { acknowledgeAlertEvent } from '@/modules/alerts/alert.service';

export const PATCH = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { eventId } = await ctx.params;
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const boss = createBoss();

          const result = await acknowledgeAlertEvent(eventId, auth.workspaceId, boss);
          if (!result) {
            return notFound(t('resources.alertEvent'));
          }

          return apiSuccess(result);
        }, 'read-write')
      )
    )
  )
);
