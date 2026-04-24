import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { createBoss } from '@/lib/jobs/boss';
import { computeScore, getLatestSnapshot } from '@/modules/visibility/seo-score.service';
import { isPeriodAligned, lastCompletePeriod } from '@/modules/visibility/seo-score.inputs';

const granularitySchema = z.enum(['weekly', 'monthly']);
const querySchema = z.object({
  brandId: z.string().min(1),
  granularity: granularitySchema.default('monthly'),
  at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const postBodySchema = z.object({
  brandId: z.string().min(1),
  granularity: granularitySchema.default('monthly'),
  periodStart: z
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
 * GET /api/v1/visibility/seo-score
 * Returns the current SEO score for a brand. Live-computed by default; pass
 * `at` to read the latest persisted snapshot instead.
 *
 * Query: brandId (required), granularity (weekly|monthly, default monthly), at? (ISO date)
 */
export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const params = Object.fromEntries(req.nextUrl.searchParams);
          const parsed = querySchema.safeParse(params);
          if (!parsed.success) {
            return badRequest(t('validation.invalidQuery'), parsed.error.flatten());
          }
          const { brandId, granularity, at } = parsed.data;

          if (!(await verifyBrand(auth.workspaceId, brandId))) {
            return notFound(t('resources.brand'));
          }

          if (at) {
            const latest = await getLatestSnapshot(auth.workspaceId, brandId, granularity);
            if (!latest) {
              return notFound(t('resources.noSnapshot'));
            }
            return apiSuccess({
              composite: latest.composite,
              compositeRaw: latest.compositeRaw,
              displayCapApplied: latest.displayCapApplied,
              code: latest.code,
              factors: latest.factors,
              contributingPromptSetIds: latest.contributingPromptSetIds,
              querySetSize: latest.querySetSize,
              dataQualityAdvisories: latest.dataQualityAdvisories,
              periodStart: latest.periodStart,
              periodEnd: latest.periodEnd,
              granularity: latest.granularity,
              formulaVersion: latest.formulaVersion,
              computedAt: latest.computedAt,
            });
          }

          const { periodStart, periodEnd } = lastCompletePeriod(new Date(), granularity);
          const result = await computeScore(
            auth.workspaceId,
            brandId,
            periodStart,
            periodEnd,
            granularity
          );

          return apiSuccess({
            composite: result.composite,
            compositeRaw: result.compositeRaw,
            displayCapApplied: result.displayCapApplied,
            code: result.code,
            factors: result.factors,
            contributingPromptSetIds: result.contributingPromptSetIds,
            querySetSize: result.querySetSize,
            dataQualityAdvisories: result.dataQualityAdvisories,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
            granularity: result.granularity,
            formulaVersion: result.formulaVersion,
            computedAt: result.computedAt,
          });
        }, 'read')
      )
    )
  )
);

/**
 * POST /api/v1/visibility/seo-score
 * Enqueue an ad-hoc recompute. Rejects misaligned `periodStart`. Returns
 * `{ jobId, deduped }` — `deduped: true` when the 120s singleton key
 * coalesces this request with one already in-flight.
 */
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const body = await req.json().catch(() => ({}));
          const parsed = postBodySchema.safeParse(body);
          if (!parsed.success) {
            return badRequest(t('validation.invalidBody'), parsed.error.flatten());
          }
          const { brandId, granularity } = parsed.data;
          let periodStart = parsed.data.periodStart;

          if (!(await verifyBrand(auth.workspaceId, brandId))) {
            return notFound(t('resources.brand'));
          }

          if (!periodStart) {
            periodStart = lastCompletePeriod(new Date(), granularity).periodStart;
          } else if (!isPeriodAligned(periodStart, granularity)) {
            return badRequest(
              granularity === 'weekly'
                ? t('visibility.periodMisalignedWeekly')
                : t('visibility.periodMisalignedMonthly')
            );
          }

          const boss = createBoss();
          const jobId = await boss.send(
            'seo-score-compute',
            {
              workspaceId: auth.workspaceId,
              brandId,
              periodStart,
              granularity,
            },
            {
              singletonKey: `seo-score:${auth.workspaceId}:${brandId}:${periodStart}:${granularity}`,
              singletonSeconds: 120,
            }
          );

          return NextResponse.json(
            {
              data: {
                status: 'enqueued',
                brandId,
                periodStart,
                granularity,
                jobId: jobId ?? null,
                deduped: jobId === null,
              },
            },
            { status: 202 }
          );
        }, 'read-write'),
        { points: 5, duration: 60 }
      )
    )
  )
);
