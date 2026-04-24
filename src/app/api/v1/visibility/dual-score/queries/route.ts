import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { getDualQueries } from '@/modules/visibility/dual-score.service';

const GAP_SIGNALS = ['high_seo_no_ai', 'high_ai_no_seo', 'balanced', 'no_signal'] as const;
const SORT_KEYS = ['impressions', 'aioCitationCount', 'avgPosition', 'gapSignal'] as const;

const querySchema = z
  .object({
    brandId: z.string().min(1),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    gapSignal: z.enum(GAP_SIGNALS).optional(),
    sort: z.enum(SORT_KEYS).default('impressions'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((v) => v.from <= v.to, { message: 'from must be <= to' });

async function verifyBrand(workspaceId: string, brandId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: brand.id })
    .from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.workspaceId, workspaceId)))
    .limit(1);
  return !!row;
}

/**
 * GET /api/v1/visibility/dual-score/queries
 * Per-query drill-in joining GSC + AIO citation aggregates, tagged by gap signal.
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
          const { brandId, from, to, gapSignal, sort, page, limit } = parsed.data;

          if (!(await verifyBrand(auth.workspaceId, brandId))) {
            return notFound(t('resources.brand'));
          }

          const result = await getDualQueries(auth.workspaceId, brandId, from, to, {
            pagination: { page, limit },
            filter: gapSignal ? { gapSignal } : undefined,
            sort,
          });
          return apiSuccess(result);
        }, 'read')
      )
    )
  )
);
