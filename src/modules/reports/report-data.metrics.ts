import { getRecommendationShare } from '@/modules/visibility/recommendation-share.service';
import { getSentimentAggregates } from '@/modules/visibility/sentiment-aggregate.service';
import { getPositionAggregates } from '@/modules/visibility/position-aggregate.service';
import { getOpportunities } from '@/modules/visibility/opportunity.service';
import { getCitationSources } from '@/modules/visibility/citation-source-aggregate.service';
import { computeDelta } from '@/modules/visibility/trend.stats';
import { capSparklinePoints } from './report-data.utils';
import type {
  MetricBlock,
  SourceMetricBlock,
  OpportunityMetricBlock,
  SparklinePoint,
} from './report-data.types';

const ALL_PAGE = { page: 1, limit: 10000, order: 'asc' as const };

interface PeriodRange {
  from: string;
  to: string;
}

export function buildMetricBlock(
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

function extractDate(periodStart: string | Date): string {
  return typeof periodStart === 'string'
    ? periodStart
    : (periodStart as Date).toISOString().slice(0, 10);
}

export async function fetchRecommendationShareMetric(
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
      date: extractDate(r.periodStart),
      value: r.sharePercentage,
    }))
  );

  const previous = compItems.length > 0 ? compShare : null;
  return buildMetricBlock(currentShare, previous, sparkline);
}

export async function fetchCitationCountMetric(
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
      date: extractDate(r.periodStart),
      value: String(r.citationCount),
    }))
  );

  const previous = compResult.items.length > 0 ? compCount : null;
  return buildMetricBlock(currentCount, previous, sparkline);
}

export async function fetchSentimentMetric(
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
      date: extractDate(r.periodStart),
      value: r.netSentimentScore,
    }))
  );

  const previous = compItems.length > 0 ? compScore : null;
  return buildMetricBlock(currentScore, previous, sparkline);
}

export async function fetchPositionsMetric(
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
      date: extractDate(r.periodStart),
      value: r.averagePosition,
    }))
  );

  const previous = compItems.length > 0 ? compAvg : null;
  return buildMetricBlock(currentAvg, previous, sparkline, true);
}

export async function fetchSourcesMetric(
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

  const domainMap = new Map<string, number>();
  for (const r of currentItems) {
    domainMap.set(r.domain, (domainMap.get(r.domain) ?? 0) + r.frequency);
  }
  const topDomains = [...domainMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, frequency]) => ({ domain, frequency }));

  const dateFreqMap = new Map<string, number>();
  for (const r of currentItems) {
    const date = extractDate(r.periodStart);
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

export async function fetchOpportunitiesMetric(
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
