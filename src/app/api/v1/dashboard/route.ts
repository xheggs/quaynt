import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, apiError, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getDashboardData } from '@/modules/dashboard/dashboard.service';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z
  .object({
    promptSetId: z.string().optional(),
    from: z.string().regex(ISO_DATE_RE, 'Invalid date format, expected YYYY-MM-DD').optional(),
    to: z.string().regex(ISO_DATE_RE, 'Invalid date format, expected YYYY-MM-DD').optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) return data.from <= data.to;
      return true;
    },
    { message: 'Start date must be before end date' }
  );

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const params = req.nextUrl.searchParams;

          const parsed = querySchema.safeParse({
            promptSetId: params.get('promptSetId') ?? undefined,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
          });

          if (!parsed.success) {
            return badRequest(parsed.error.issues[0]?.message);
          }

          try {
            const data = await getDashboardData(auth.workspaceId, parsed.data);
            return apiSuccess(data);
          } catch (err) {
            const error = err as Error & { code?: string; warnings?: string[] };

            if (error.code === 'PROMPT_SET_NOT_FOUND') {
              return badRequest(t('resources.promptSet'));
            }

            if (error.code === 'ALL_SECTIONS_FAILED') {
              return apiError('SERVICE_UNAVAILABLE', t('dashboard.unavailable'), 503, {
                warnings: error.warnings,
              });
            }

            throw err;
          }
        }, 'read')
      )
    )
  )
);
