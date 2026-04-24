import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getTopAiCitedQueries } from '@/modules/integrations/gsc-correlation/gsc-correlation.service';

const MAX_RANGE_DAYS = 90;
const MAX_LIMIT = 100;

const filtersSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    propertyUrl: z.string().max(2048).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(25),
  })
  .refine(
    (v) => {
      const diff = (new Date(v.to).getTime() - new Date(v.from).getTime()) / 86_400_000;
      return diff >= 0 && diff <= MAX_RANGE_DAYS;
    },
    { message: `Date range must be 0-${MAX_RANGE_DAYS} days` }
  );

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const parsed = filtersSchema.safeParse(
            Object.fromEntries(req.nextUrl.searchParams.entries())
          );
          if (!parsed.success) return badRequest(t('validation.invalidFilter'));

          const { from, to, propertyUrl, page, limit } = parsed.data;
          const result = await getTopAiCitedQueries(
            auth.workspaceId,
            { from, to, propertyUrl },
            { page, limit }
          );
          return apiSuccess({
            data: result.items,
            meta: {
              total: result.total,
              page,
              limit,
              hasMore: page * limit < result.total,
            },
          });
        }, 'read')
      )
    )
  )
);
