import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, forbidden } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { routing } from '@/lib/i18n/routing';
import {
  getOrCreateUserPreference,
  updateUserPreference,
} from '@/modules/user/user-preference.service';

const updatePreferenceSchema = z.object({
  locale: z
    .string()
    .max(10)
    .refine((val) => routing.locales.includes(val as (typeof routing.locales)[number]), {
      message: 'Unsupported locale',
    })
    .nullable()
    .optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();

          if (!auth.userId) {
            return forbidden(t('user.preferencesSessionRequired'));
          }

          const preference = await getOrCreateUserPreference(auth.userId);
          return apiSuccess(preference);
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
          const auth = getAuthContext(req);
          const t = await apiErrors();

          if (!auth.userId) {
            return forbidden(t('user.preferencesSessionRequired'));
          }

          const validated = await validateRequest(req, ctx, {
            body: updatePreferenceSchema,
          });
          if (!validated.success) return validated.response;

          const updated = await updateUserPreference(auth.userId, validated.data.body);
          return apiSuccess(updated);
        }, 'read-write')
      )
    )
  )
);
