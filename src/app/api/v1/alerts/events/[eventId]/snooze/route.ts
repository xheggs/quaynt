import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, notFound, unprocessable } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { snoozeAlertEvent } from '@/modules/alerts/alert.service';

const snoozeSchema = z
  .object({
    duration: z.number().int().min(60).max(2_592_000).optional(),
    snoozedUntil: z.string().datetime().optional(),
  })
  .refine((data) => (data.duration != null) !== (data.snoozedUntil != null), {
    message: 'Provide exactly one of duration (seconds) or snoozedUntil (ISO 8601)',
  });

export const PATCH = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { eventId } = await ctx.params;
          const t = await apiErrors();
          const validated = await validateRequest(req, ctx, {
            body: snoozeSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const result = await snoozeAlertEvent(eventId, auth.workspaceId, validated.data.body);
            if (!result) {
              return notFound(t('resources.alertEvent'));
            }
            return apiSuccess(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to snooze alert event';
            return unprocessable([{ field: 'snooze', message }]);
          }
        }, 'read-write')
      )
    )
  )
);
