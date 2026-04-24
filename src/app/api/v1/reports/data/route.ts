import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getReportData } from '@/modules/reports/report-data.service';
import { VALID_REPORT_METRICS } from '@/modules/reports/report-data.types';
import type { ReportMetric } from '@/modules/reports/report-data.types';

const comparisonPeriodEnum = z.enum(['previous_period', 'previous_week', 'previous_month']);
const reportMetricEnum = z.enum([
  'recommendation_share',
  'citation_count',
  'sentiment',
  'positions',
  'sources',
  'opportunities',
]);

const MAX_BRANDS = 25;

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const params = req.nextUrl.searchParams;

          const promptSetId = params.get('promptSetId');
          if (!promptSetId) {
            return badRequest(t('reports.promptSetRequired'));
          }

          const brandId = params.get('brandId') ?? undefined;
          const rawBrandIds = params.get('brandIds');
          const brandIds = rawBrandIds ? rawBrandIds.split(',').filter(Boolean) : undefined;

          if (!brandId && !brandIds) {
            return badRequest(t('visibility.brandsRequired'));
          }

          if (brandId && brandIds) {
            return badRequest(
              t('validation.provideEitherNotBoth', { a: 'brandId', b: 'brandIds' })
            );
          }

          if (brandIds && brandIds.length > MAX_BRANDS) {
            return badRequest(t('reports.maxBrands', { max: MAX_BRANDS }));
          }

          const rawComparisonPeriod = params.get('comparisonPeriod');
          if (rawComparisonPeriod) {
            const parsed = comparisonPeriodEnum.safeParse(rawComparisonPeriod);
            if (!parsed.success) {
              return badRequest(t('reports.invalidComparisonPeriod'));
            }
          }

          const rawMetrics = params.get('metrics');
          let metrics: ReportMetric[] | undefined;
          if (rawMetrics) {
            const metricList = rawMetrics.split(',').filter(Boolean);
            for (const m of metricList) {
              const parsed = reportMetricEnum.safeParse(m);
              if (!parsed.success) {
                return badRequest(
                  t('reports.invalidMetric', {
                    metric: m,
                    allowed: VALID_REPORT_METRICS.join(', '),
                  })
                );
              }
            }
            metrics = metricList as ReportMetric[];
          }

          const filters = {
            promptSetId,
            brandId,
            brandIds,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
            comparisonPeriod:
              (rawComparisonPeriod as 'previous_period' | 'previous_week' | 'previous_month') ??
              undefined,
            metrics,
            platformId: params.get('platformId') ?? undefined,
            locale: params.get('locale') ?? undefined,
          };

          const result = await getReportData(auth.workspaceId, filters);

          return apiSuccess(result);
        }, 'read')
      )
    )
  )
);
