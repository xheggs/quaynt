import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { computeScore } from '@/modules/visibility/geo-score.service';
import { lastCompletePeriod } from '@/modules/visibility/geo-score.inputs';

const querySchema = z.object({
  brandId: z.string().min(1),
  granularity: z.enum(['weekly', 'monthly']).default('monthly'),
  at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
          if (!parsed.success) {
            return badRequest(t('validation.invalidQuery'), parsed.error.flatten());
          }
          const { brandId, granularity } = parsed.data;

          const [brandRow] = await db
            .select({ id: brand.id })
            .from(brand)
            .where(and(eq(brand.id, brandId), eq(brand.workspaceId, auth.workspaceId)))
            .limit(1);

          if (!brandRow) return notFound(t('resources.brand'));

          const { periodStart, periodEnd } = lastCompletePeriod(new Date(), granularity);
          const result = await computeScore(
            auth.workspaceId,
            brandId,
            periodStart,
            periodEnd,
            granularity
          );

          return apiSuccess({
            recommendations: result.recommendations,
            periodStart,
            periodEnd,
            granularity,
            formulaVersion: result.formulaVersion,
          });
        }, 'read')
      )
    )
  )
);
