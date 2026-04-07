import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { computeComparisonDates } from '@/modules/visibility/comparison.utils';
import { resolveSparklineGranularity } from './report-data.utils';
import {
  fetchRecommendationShareMetric,
  fetchCitationCountMetric,
  fetchSentimentMetric,
  fetchPositionsMetric,
  fetchSourcesMetric,
  fetchOpportunitiesMetric,
} from './report-data.metrics';
import type {
  ReportMetric,
  ReportDataFilters,
  ReportDataResponse,
  BrandReportData,
  SourceMetricBlock,
  OpportunityMetricBlock,
} from './report-data.types';
import { VALID_REPORT_METRICS } from './report-data.types';

const ALL_SENTINEL = '_all';
const BRAND_BATCH_SIZE = 5;

interface PeriodRange {
  from: string;
  to: string;
}

interface ResolvedFilters {
  promptSetId: string;
  brandList: string[];
  from: string;
  to: string;
  comparisonPeriod: 'previous_period' | 'previous_week' | 'previous_month';
  metrics: ReportMetric[];
  platformId: string;
  locale: string;
}

function resolveReportDefaults(filters: ReportDataFilters): ResolvedFilters {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  let to = filters.to;
  let from = filters.from;

  if (from && !to) to = todayStr;
  if (to && !from) {
    const d = new Date(to);
    d.setDate(d.getDate() - 30);
    from = d.toISOString().slice(0, 10);
  }
  if (!from && !to) {
    to = todayStr;
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    from = d.toISOString().slice(0, 10);
  }

  const brandList = filters.brandId ? [filters.brandId] : (filters.brandIds ?? []);

  return {
    promptSetId: filters.promptSetId,
    brandList,
    from: from!,
    to: to!,
    comparisonPeriod: filters.comparisonPeriod ?? 'previous_period',
    metrics: filters.metrics ?? [...VALID_REPORT_METRICS],
    platformId: filters.platformId ?? ALL_SENTINEL,
    locale: filters.locale ?? ALL_SENTINEL,
  };
}

async function fetchMetricsForBrand(
  workspaceId: string,
  resolved: ResolvedFilters,
  brandId: string,
  currentPeriod: PeriodRange,
  compPeriod: PeriodRange,
  granularity: 'day' | 'week' | 'month'
): Promise<BrandReportData['metrics']> {
  const { promptSetId, metrics, platformId, locale } = resolved;
  const warnings: string[] = [];

  const fetchers = [
    metrics.includes('recommendation_share')
      ? fetchRecommendationShareMetric(
          workspaceId,
          promptSetId,
          brandId,
          currentPeriod,
          compPeriod,
          granularity,
          platformId,
          locale
        ).catch((err) => {
          warnings.push(`recommendation_share: ${(err as Error).message}`);
          return null;
        })
      : null,
    metrics.includes('citation_count')
      ? fetchCitationCountMetric(
          workspaceId,
          promptSetId,
          brandId,
          currentPeriod,
          compPeriod,
          granularity,
          platformId,
          locale
        ).catch((err) => {
          warnings.push(`citation_count: ${(err as Error).message}`);
          return null;
        })
      : null,
    metrics.includes('sentiment')
      ? fetchSentimentMetric(
          workspaceId,
          promptSetId,
          brandId,
          currentPeriod,
          compPeriod,
          granularity,
          platformId,
          locale
        ).catch((err) => {
          warnings.push(`sentiment: ${(err as Error).message}`);
          return null;
        })
      : null,
    metrics.includes('positions')
      ? fetchPositionsMetric(
          workspaceId,
          promptSetId,
          brandId,
          currentPeriod,
          compPeriod,
          granularity,
          platformId,
          locale
        ).catch((err) => {
          warnings.push(`positions: ${(err as Error).message}`);
          return null;
        })
      : null,
    metrics.includes('sources')
      ? fetchSourcesMetric(
          workspaceId,
          promptSetId,
          brandId,
          currentPeriod,
          compPeriod,
          granularity,
          platformId,
          locale
        ).catch((err) => {
          warnings.push(`sources: ${(err as Error).message}`);
          return null;
        })
      : null,
    metrics.includes('opportunities')
      ? fetchOpportunitiesMetric(
          workspaceId,
          promptSetId,
          brandId,
          currentPeriod,
          compPeriod
        ).catch((err) => {
          warnings.push(`opportunities: ${(err as Error).message}`);
          return null;
        })
      : null,
  ];

  const [recShare, citations, sentiment, positions, sources, opportunities] =
    await Promise.all(fetchers);

  const result: BrandReportData['metrics'] = {};
  if (recShare) result.recommendationShare = recShare;
  if (citations) result.citationCount = citations;
  if (sentiment) result.sentiment = sentiment;
  if (positions) result.positions = positions;
  if (sources) result.sources = sources as SourceMetricBlock;
  if (opportunities) result.opportunities = opportunities as OpportunityMetricBlock;

  return result;
}

async function fetchBrandName(workspaceId: string, brandId: string): Promise<string | null> {
  const rows = await db
    .select({ name: brand.name })
    .from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.workspaceId, workspaceId)))
    .limit(1);
  return rows[0]?.name ?? null;
}

async function fetchPromptSetName(workspaceId: string, promptSetId: string): Promise<string> {
  const rows = await db
    .select({ name: promptSet.name })
    .from(promptSet)
    .where(and(eq(promptSet.id, promptSetId), eq(promptSet.workspaceId, workspaceId)))
    .limit(1);
  return rows[0]?.name ?? '';
}

export async function getReportData(
  workspaceId: string,
  filters: ReportDataFilters
): Promise<ReportDataResponse> {
  const resolved = resolveReportDefaults(filters);
  const { compFrom, compTo } = computeComparisonDates(
    resolved.from,
    resolved.to,
    resolved.comparisonPeriod
  );

  const currentPeriod: PeriodRange = { from: resolved.from, to: resolved.to };
  const compPeriod: PeriodRange = { from: compFrom, to: compTo };
  const granularity = resolveSparklineGranularity(resolved.from, resolved.to);

  const warnings: string[] = [];
  const brandResults: BrandReportData[] = [];

  for (let i = 0; i < resolved.brandList.length; i += BRAND_BATCH_SIZE) {
    const batch = resolved.brandList.slice(i, i + BRAND_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (brandId) => {
        const brandName = await fetchBrandName(workspaceId, brandId);
        if (brandName === null) return null;

        const metrics = await fetchMetricsForBrand(
          workspaceId,
          resolved,
          brandId,
          currentPeriod,
          compPeriod,
          granularity
        );

        return {
          brand: { brandId, brandName },
          metrics,
        } satisfies BrandReportData;
      })
    );

    for (const result of batchResults) {
      if (result) brandResults.push(result);
    }
  }

  const marketName = await fetchPromptSetName(workspaceId, resolved.promptSetId);

  const response: ReportDataResponse = {
    market: { promptSetId: resolved.promptSetId, name: marketName },
    period: {
      from: resolved.from,
      to: resolved.to,
      comparisonFrom: compFrom,
      comparisonTo: compTo,
    },
    filters: { platformId: resolved.platformId, locale: resolved.locale },
    brands: brandResults,
  };

  if (warnings.length > 0) {
    response.warnings = warnings;
  }

  return response;
}
