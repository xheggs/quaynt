import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest, notFound } from '@/lib/api/response';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { getTrends } from '@/modules/visibility/trend.service';
import type { TrendMetric, TrendPeriod } from '@/modules/visibility/trend.types';

const metricEnum = z.enum([
  'recommendation_share',
  'sentiment',
  'average_position',
  'first_mention_rate',
  'citation_count',
  'opportunity_count',
]);

const periodEnum = z.enum(['weekly', 'monthly']);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const params = req.nextUrl.searchParams;

          // Required params
          const rawMetric = params.get('metric');
          if (!rawMetric) {
            return badRequest('metric is required');
          }
          const metricParsed = metricEnum.safeParse(rawMetric);
          if (!metricParsed.success) {
            return badRequest(`Invalid metric. Must be one of: ${metricEnum.options.join(', ')}`);
          }

          const promptSetId = params.get('promptSetId');
          if (!promptSetId) {
            return badRequest('promptSetId is required');
          }

          const brandId = params.get('brandId');
          if (!brandId) {
            return badRequest('brandId is required');
          }

          // Optional params
          const rawPeriod = params.get('period');
          if (rawPeriod) {
            const periodParsed = periodEnum.safeParse(rawPeriod);
            if (!periodParsed.success) {
              return badRequest("period must be 'weekly' or 'monthly'");
            }
          }

          const rawFrom = params.get('from');
          if (rawFrom && !dateSchema.safeParse(rawFrom).success) {
            return badRequest('from must be a valid date (YYYY-MM-DD)');
          }

          const rawTo = params.get('to');
          if (rawTo && !dateSchema.safeParse(rawTo).success) {
            return badRequest('to must be a valid date (YYYY-MM-DD)');
          }

          // Verify brand and prompt set exist in workspace
          const [brandRow, promptSetRow] = await Promise.all([
            db
              .select({ id: brand.id })
              .from(brand)
              .where(
                and(
                  eq(brand.id, brandId),
                  eq(brand.workspaceId, auth.workspaceId),
                  isNull(brand.deletedAt)
                )
              )
              .limit(1),
            db
              .select({ id: promptSet.id })
              .from(promptSet)
              .where(
                and(
                  eq(promptSet.id, promptSetId),
                  eq(promptSet.workspaceId, auth.workspaceId),
                  isNull(promptSet.deletedAt)
                )
              )
              .limit(1),
          ]);

          if (!brandRow[0]) {
            return notFound('Brand');
          }
          if (!promptSetRow[0]) {
            return notFound('Prompt set');
          }

          const includeMovingAverage = params.get('includeMovingAverage') !== 'false';

          const result = await getTrends(auth.workspaceId, {
            metric: metricParsed.data as TrendMetric,
            promptSetId,
            brandId,
            platformId: params.get('platformId') ?? undefined,
            locale: params.get('locale') ?? undefined,
            period: (rawPeriod as TrendPeriod) ?? undefined,
            from: rawFrom ?? undefined,
            to: rawTo ?? undefined,
            includeMovingAverage,
          });

          return apiSuccess(result);
        }, 'read')
      )
    )
  )
);
