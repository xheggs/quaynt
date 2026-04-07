import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { getRecommendationShare } from '@/modules/visibility/recommendation-share.service';
import { getSentimentAggregates } from '@/modules/visibility/sentiment-aggregate.service';
import { getPositionAggregates } from '@/modules/visibility/position-aggregate.service';
import { getOpportunities } from '@/modules/visibility/opportunity.service';
import { getCitationSources } from '@/modules/visibility/citation-source-aggregate.service';
import { computeComparisonDates } from '@/modules/visibility/comparison.utils';
import { computeDelta } from '@/modules/visibility/trend.stats';
import { resolveSparklineGranularity, capSparklinePoints } from './report-data.utils';
import type {
  ReportMetric,
  ReportDataFilters,
  ReportDataResponse,
  MetricBlock,
  SourceMetricBlock,
  OpportunityMetricBlock,
  BrandReportData,
  SparklinePoint,
} from './report-data.types';
import { VALID_REPORT_METRICS } from './report-data.types';

const ALL_SENTINEL = '_all';
const BRAND_BATCH_SIZE = 5;
const ALL_PAGE = { page: 1, limit: 10000, order: 'asc' as const };

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

function buildMetricBlock(
  current: number,
  previous: number | null,
  sparkline: SparklinePoint[],
  invertDirection = false
): MetricBlock {
  if (previous === null) {
    return {
      current: current.toFixed(2),
      previous: null,
      delta: null,
      changeRate: null,
      direction: null,
      sparkline,
    };
  }

  const { delta, changeRate, direction } = computeDelta(current, previous);

  const effectiveDirection = invertDirection
    ? direction === 'up'
      ? 'down'
      : direction === 'down'
        ? 'up'
        : direction
    : direction;

  return {
    current: current.toFixed(2),
    previous: previous.toFixed(2),
    delta: delta.toFixed(2),
    changeRate: changeRate !== null ? changeRate.toFixed(2) : null,
    direction: effectiveDirection,
    sparkline,
  };
}

async function fetchRecommendationShareMetric(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  currentPeriod: PeriodRange,
  comparisonPeriod: PeriodRange,
  granularity: 'day' | 'week' | 'month',
  platformId: string,
  locale: string
): Promise<MetricBlock> {
  const baseFilters = { promptSetId, brandId, platformId, locale, granularity };

  const [currentResult, compResult] = await Promise.all([
    getRecommendationShare(
      workspaceId,
      { ...baseFilters, from: currentPeriod.from, to: currentPeriod.to },
      ALL_PAGE
    ),
    getRecommendationShare(
      workspaceId,
      { ...baseFilters, from: comparisonPeriod.from, to: comparisonPeriod.to },
      ALL_PAGE
    ),
  ]);

  const currentItems = currentResult.items;
  const compItems = compResult.items;

  const currentTotal = currentItems.reduce((sum, r) => sum + r.totalCitations, 0);
  const currentCitations = currentItems.reduce((sum, r) => sum + r.citationCount, 0);
  const currentShare = currentTotal > 0 ? (currentCitations / currentTotal) * 100 : 0;

  const compTotal = compItems.reduce((sum, r) => sum + r.totalCitations, 0);
  const compCitations = compItems.reduce((sum, r) => sum + r.citationCount, 0);
  const compShare = compTotal > 0 ? (compCitations / compTotal) * 100 : 0;

  const sparkline = capSparklinePoints(
    currentItems.map((r) => ({
      date:
        typeof r.periodStart === 'string'
          ? r.periodStart
          : (r.periodStart as Date).toISOString().slice(0, 10),
      value: r.sharePercentage,
    }))
  );

  const previous = compItems.length > 0 ? compShare : null;
  return buildMetricBlock(currentShare, previous, sparkline);
}

async function fetchCitationCountMetric(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  currentPeriod: PeriodRange,
  comparisonPeriod: PeriodRange,
  granularity: 'day' | 'week' | 'month',
  platformId: string,
  locale: string
): Promise<MetricBlock> {
  const baseFilters = { promptSetId, brandId, platformId, locale, granularity };

  const [currentResult, compResult] = await Promise.all([
    getRecommendationShare(
      workspaceId,
      { ...baseFilters, from: currentPeriod.from, to: currentPeriod.to },
      ALL_PAGE
    ),
    getRecommendationShare(
      workspaceId,
      { ...baseFilters, from: comparisonPeriod.from, to: comparisonPeriod.to },
      ALL_PAGE
    ),
  ]);

  const currentCount = currentResult.items.reduce((sum, r) => sum + r.citationCount, 0);
  const compCount = compResult.items.reduce((sum, r) => sum + r.citationCount, 0);

  const sparkline = capSparklinePoints(
    currentResult.items.map((r) => ({
      date:
        typeof r.periodStart === 'string'
          ? r.periodStart
          : (r.periodStart as Date).toISOString().slice(0, 10),
      value: String(r.citationCount),
    }))
  );

  const previous = compResult.items.length > 0 ? compCount : null;
  return buildMetricBlock(currentCount, previous, sparkline);
}

async function fetchSentimentMetric(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  currentPeriod: PeriodRange,
  comparisonPeriod: PeriodRange,
  granularity: 'day' | 'week' | 'month',
  platformId: string,
  locale: string
): Promise<MetricBlock> {
  const baseFilters = { promptSetId, brandId, platformId, locale, granularity };

  const [currentResult, compResult] = await Promise.all([
    getSentimentAggregates(
      workspaceId,
      { ...baseFilters, from: currentPeriod.from, to: currentPeriod.to },
      ALL_PAGE
    ),
    getSentimentAggregates(
      workspaceId,
      { ...baseFilters, from: comparisonPeriod.from, to: comparisonPeriod.to },
      ALL_PAGE
    ),
  ]);

  const currentItems = currentResult.items;
  const compItems = compResult.items;

  const currentTotalCount = currentItems.reduce((sum, r) => sum + r.totalCount, 0);
  const currentWeighted = currentItems.reduce(
    (sum, r) => sum + parseFloat(r.netSentimentScore) * r.totalCount,
    0
  );
  const currentScore = currentTotalCount > 0 ? currentWeighted / currentTotalCount : 0;

  const compTotalCount = compItems.reduce((sum, r) => sum + r.totalCount, 0);
  const compWeighted = compItems.reduce(
    (sum, r) => sum + parseFloat(r.netSentimentScore) * r.totalCount,
    0
  );
  const compScore = compTotalCount > 0 ? compWeighted / compTotalCount : 0;

  const sparkline = capSparklinePoints(
    currentItems.map((r) => ({
      date:
        typeof r.periodStart === 'string'
          ? r.periodStart
          : (r.periodStart as Date).toISOString().slice(0, 10),
      value: r.netSentimentScore,
    }))
  );

  const previous = compItems.length > 0 ? compScore : null;
  return buildMetricBlock(currentScore, previous, sparkline);
}

async function fetchPositionsMetric(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  currentPeriod: PeriodRange,
  comparisonPeriod: PeriodRange,
  granularity: 'day' | 'week' | 'month',
  platformId: string,
  locale: string
): Promise<MetricBlock> {
  const baseFilters = { promptSetId, brandId, platformId, locale, granularity };

  const [currentResult, compResult] = await Promise.all([
    getPositionAggregates(
      workspaceId,
      { ...baseFilters, from: currentPeriod.from, to: currentPeriod.to },
      ALL_PAGE
    ),
    getPositionAggregates(
      workspaceId,
      { ...baseFilters, from: comparisonPeriod.from, to: comparisonPeriod.to },
      ALL_PAGE
    ),
  ]);

  const currentItems = currentResult.items;
  const compItems = compResult.items;

  const currentTotalCitations = currentItems.reduce((sum, r) => sum + r.citationCount, 0);
  const currentWeighted = currentItems.reduce(
    (sum, r) => sum + parseFloat(r.averagePosition) * r.citationCount,
    0
  );
  const currentAvg = currentTotalCitations > 0 ? currentWeighted / currentTotalCitations : 0;

  const compTotalCitations = compItems.reduce((sum, r) => sum + r.citationCount, 0);
  const compWeighted = compItems.reduce(
    (sum, r) => sum + parseFloat(r.averagePosition) * r.citationCount,
    0
  );
  const compAvg = compTotalCitations > 0 ? compWeighted / compTotalCitations : 0;

  const sparkline = capSparklinePoints(
    currentItems.map((r) => ({
      date:
        typeof r.periodStart === 'string'
          ? r.periodStart
          : (r.periodStart as Date).toISOString().slice(0, 10),
      value: r.averagePosition,
    }))
  );

  const previous = compItems.length > 0 ? compAvg : null;
  return buildMetricBlock(currentAvg, previous, sparkline, true);
}

async function fetchSourcesMetric(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  currentPeriod: PeriodRange,
  comparisonPeriod: PeriodRange,
  granularity: 'day' | 'week' | 'month',
  platformId: string,
  locale: string
): Promise<SourceMetricBlock> {
  const baseFilters = { promptSetId, brandId, platformId, locale, granularity };

  const [currentResult, compResult] = await Promise.all([
    getCitationSources(
      workspaceId,
      { ...baseFilters, from: currentPeriod.from, to: currentPeriod.to },
      ALL_PAGE
    ),
    getCitationSources(
      workspaceId,
      { ...baseFilters, from: comparisonPeriod.from, to: comparisonPeriod.to },
      ALL_PAGE
    ),
  ]);

  const currentItems = currentResult.items;
  const compItems = compResult.items;

  const currentTotal = currentItems.reduce((sum, r) => sum + r.frequency, 0);
  const compTotal = compItems.reduce((sum, r) => sum + r.frequency, 0);

  // Aggregate top domains from current period
  const domainMap = new Map<string, number>();
  for (const r of currentItems) {
    domainMap.set(r.domain, (domainMap.get(r.domain) ?? 0) + r.frequency);
  }
  const topDomains = [...domainMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, frequency]) => ({ domain, frequency }));

  // Build sparkline by summing frequency per date
  const dateFreqMap = new Map<string, number>();
  for (const r of currentItems) {
    const date =
      typeof r.periodStart === 'string'
        ? r.periodStart
        : (r.periodStart as Date).toISOString().slice(0, 10);
    dateFreqMap.set(date, (dateFreqMap.get(date) ?? 0) + r.frequency);
  }
  const sparkline = capSparklinePoints(
    [...dateFreqMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, freq]) => ({ date, value: String(freq) }))
  );

  const previous = compItems.length > 0 ? compTotal : null;
  const base = buildMetricBlock(currentTotal, previous, sparkline);

  return { ...base, topDomains };
}

async function fetchOpportunitiesMetric(
  workspaceId: string,
  promptSetId: string,
  brandId: string,
  currentPeriod: PeriodRange,
  comparisonPeriod: PeriodRange
): Promise<OpportunityMetricBlock> {
  const baseFilters = { promptSetId, brandId };

  const [currentResult, compResult] = await Promise.all([
    getOpportunities(
      workspaceId,
      { ...baseFilters, from: currentPeriod.from, to: currentPeriod.to },
      ALL_PAGE
    ),
    getOpportunities(
      workspaceId,
      { ...baseFilters, from: comparisonPeriod.from, to: comparisonPeriod.to },
      ALL_PAGE
    ),
  ]);

  const currentTotal = currentResult.summary.totalOpportunities;
  const compTotal = compResult.summary.totalOpportunities;

  // Bucket sparkline by periodStart manually (no native granularity support)
  const dateBuckets = new Map<string, number>();
  for (const r of currentResult.items) {
    const date = typeof r.periodStart === 'string' ? r.periodStart : String(r.periodStart);
    dateBuckets.set(date, (dateBuckets.get(date) ?? 0) + 1);
  }
  const sparkline = capSparklinePoints(
    [...dateBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, value: String(count) }))
  );

  const previous = compResult.items.length > 0 ? compTotal : null;
  const base = buildMetricBlock(currentTotal, previous, sparkline);

  return {
    ...base,
    byType: {
      missing: currentResult.summary.missingCount,
      weak: currentResult.summary.weakCount,
    },
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

  // Process brands in batches of BRAND_BATCH_SIZE
  for (let i = 0; i < resolved.brandList.length; i += BRAND_BATCH_SIZE) {
    const batch = resolved.brandList.slice(i, i + BRAND_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (brandId) => {
        const brandName = await fetchBrandName(workspaceId, brandId);
        if (brandName === null) return null; // unknown brand — silently skip

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
