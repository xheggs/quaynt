import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiError, apiSuccess, badRequest, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { getCombinedRecommendations } from '@/modules/visibility/dual-score.service';
import { lastCompletePeriod } from '@/modules/visibility/seo-score.inputs';

const querySchema = z.object({
  brandId: z.string().min(1),
  granularity: z.enum(['weekly', 'monthly']).default('monthly'),
  at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

async function verifyBrand(workspaceId: string, brandId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: brand.id })
    .from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.workspaceId, workspaceId)))
    .limit(1);
  return !!row;
}

/**
 * GET /api/v1/visibility/dual-score/recommendations
 * Interleaved SEO + GEO recommendations sorted by estimatedPointDelta desc.
 * Returns `partial: true` + `failedSource` when one side throws; 500 when both fail.
 */
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
          const { brandId, granularity, at } = parsed.data;

          if (!(await verifyBrand(auth.workspaceId, brandId))) {
            return notFound(t('resources.brand'));
          }

          const anchor = at ? new Date(`${at}T00:00:00Z`) : new Date();
          const { periodStart, periodEnd } = lastCompletePeriod(anchor, granularity);

          try {
            const result = await getCombinedRecommendations(
              auth.workspaceId,
              brandId,
              periodStart,
              periodEnd,
              granularity
            );
            return apiSuccess({
              ...result,
              periodStart,
              periodEnd,
              granularity,
            });
          } catch {
            return apiError('INTERNAL_ERROR', t('visibility.combinedRecommendationsFailed'), 500);
          }
        }, 'read')
      )
    )
  )
);
