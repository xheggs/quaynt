import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { computeComparisonDates } from '@/modules/visibility/comparison.utils';
import { computeDelta } from '@/modules/visibility/trend.stats';
import {
  resolveSparklineGranularity,
  capSparklinePoints,
} from '@/modules/reports/report-data.utils';
import { recommendationShare } from '@/modules/visibility/recommendation-share.schema';
import { sentimentAggregate } from '@/modules/visibility/sentiment-aggregate.schema';
import { trendSnapshot } from '@/modules/visibility/trend-snapshot.schema';
import type { MetricBlock, SparklinePoint } from '@/modules/reports/report-data.types';
import type { DashboardKPIs, DashboardTrends } from './dashboard.types';
import type { ResolvedContext } from './dashboard.context';
import { desc } from 'drizzle-orm';

const ALL_SENTINEL = '_all';

export async function computeKPIs(ctx: ResolvedContext): Promise<DashboardKPIs> {
  const { workspaceId, promptSetId, from, to, brandMap } = ctx;
  const brandIds = Array.from(brandMap.keys());

  if (brandIds.length === 0) {
    return {
      recommendationShare: emptyMetricBlock(),
      totalCitations: emptyMetricBlock(),
      averageSentiment: emptyMetricBlock(),
    };
  }

  const { compFrom, compTo } = computeComparisonDates(from, to, 'previous_period');
  const granularity = resolveSparklineGranularity(from, to);

  // Current period: recommendation share data per brand
  const currentShareRows = await db
    .select({
      brandId: recommendationShare.brandId,
      sharePercentage: recommendationShare.sharePercentage,
      citationCount: recommendationShare.citationCount,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.promptSetId, promptSetId),
        eq(recommendationShare.platformId, ALL_SENTINEL),
        eq(recommendationShare.locale, ALL_SENTINEL),
        inArray(recommendationShare.brandId, brandIds),
        gte(recommendationShare.periodStart, from),
        lte(recommendationShare.periodStart, to)
      )
    );

  const currentAgg = aggregateShareRows(currentShareRows);

  // Previous period
  const prevShareRows = await db
    .select({
      brandId: recommendationShare.brandId,
      sharePercentage: recommendationShare.sharePercentage,
      citationCount: recommendationShare.citationCount,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.promptSetId, promptSetId),
        eq(recommendationShare.platformId, ALL_SENTINEL),
        eq(recommendationShare.locale, ALL_SENTINEL),
        inArray(recommendationShare.brandId, brandIds),
        gte(recommendationShare.periodStart, compFrom),
        lte(recommendationShare.periodStart, compTo)
      )
    );

  const prevAgg = aggregateShareRows(prevShareRows);

  // Sentiment - current
  const currentSentimentRows = await db
    .select({
      brandId: sentimentAggregate.brandId,
      netSentimentScore: sentimentAggregate.netSentimentScore,
      totalCount: sentimentAggregate.totalCount,
    })
    .from(sentimentAggregate)
    .where(
      and(
        eq(sentimentAggregate.workspaceId, workspaceId),
        eq(sentimentAggregate.promptSetId, promptSetId),
        eq(sentimentAggregate.platformId, ALL_SENTINEL),
        eq(sentimentAggregate.locale, ALL_SENTINEL),
        inArray(sentimentAggregate.brandId, brandIds),
        gte(sentimentAggregate.periodStart, from),
        lte(sentimentAggregate.periodStart, to)
      )
    );

  const currentSentiment = aggregateSentimentRows(currentSentimentRows);

  // Sentiment - previous
  const prevSentimentRows = await db
    .select({
      brandId: sentimentAggregate.brandId,
      netSentimentScore: sentimentAggregate.netSentimentScore,
      totalCount: sentimentAggregate.totalCount,
    })
    .from(sentimentAggregate)
    .where(
      and(
        eq(sentimentAggregate.workspaceId, workspaceId),
        eq(sentimentAggregate.promptSetId, promptSetId),
        eq(sentimentAggregate.platformId, ALL_SENTINEL),
        eq(sentimentAggregate.locale, ALL_SENTINEL),
        inArray(sentimentAggregate.brandId, brandIds),
        gte(sentimentAggregate.periodStart, compFrom),
        lte(sentimentAggregate.periodStart, compTo)
      )
    );

  const prevSentiment = aggregateSentimentRows(prevSentimentRows);

  // Sparklines
  const [shareSparkline, citationSparkline, sentimentSparkline] = await Promise.all([
    fetchShareSparkline(workspaceId, promptSetId, brandIds, from, to, granularity),
    fetchCitationSparkline(workspaceId, promptSetId, brandIds, from, to, granularity),
    fetchSentimentSparkline(workspaceId, promptSetId, brandIds, from, to, granularity),
  ]);

  // Build MetricBlocks
  const shareDelta = buildDelta(currentAgg.weightedShare, prevAgg.weightedShare);
  const citationDelta = buildDelta(currentAgg.totalCitations, prevAgg.totalCitations);
  const sentimentDelta = buildDelta(currentSentiment.weightedScore, prevSentiment.weightedScore);

  const kpis: DashboardKPIs = {
    recommendationShare: {
      current: currentAgg.weightedShare.toFixed(2),
      previous: prevAgg.totalCitations > 0 ? prevAgg.weightedShare.toFixed(2) : null,
      delta: shareDelta.delta,
      changeRate: shareDelta.changeRate,
      direction: shareDelta.direction,
      sparkline: capSparklinePoints(shareSparkline),
    },
    totalCitations: {
      current: String(currentAgg.totalCitations),
      previous: prevAgg.totalCitations > 0 ? String(prevAgg.totalCitations) : null,
      delta: citationDelta.delta,
      changeRate: citationDelta.changeRate,
      direction: citationDelta.direction,
      sparkline: capSparklinePoints(citationSparkline),
    },
    averageSentiment: {
      current: currentSentiment.weightedScore.toFixed(2),
      previous: prevSentiment.totalCount > 0 ? prevSentiment.weightedScore.toFixed(2) : null,
      delta: sentimentDelta.delta,
      changeRate: sentimentDelta.changeRate,
      direction: sentimentDelta.direction,
      sparkline: capSparklinePoints(sentimentSparkline),
    },
  };

  // Commercial trend enrichment
  if (env.QUAYNT_EDITION === 'commercial' || env.QUAYNT_EDITION === 'enterprise') {
    const trends = await fetchTrendEnrichment(workspaceId, promptSetId, brandIds, from, to);
    if (trends) {
      kpis.trends = trends;
    }
  }

  return kpis;
}

interface ShareAgg {
  weightedShare: number;
  totalCitations: number;
}

function aggregateShareRows(
  rows: Array<{ brandId: string; sharePercentage: string; citationCount: number }>
): ShareAgg {
  const byBrand = new Map<string, { totalShare: number; totalCitations: number }>();

  for (const row of rows) {
    const existing = byBrand.get(row.brandId) ?? { totalShare: 0, totalCitations: 0 };
    existing.totalShare += Number(row.sharePercentage) * row.citationCount;
    existing.totalCitations += row.citationCount;
    byBrand.set(row.brandId, existing);
  }

  let grandTotalCitations = 0;
  let grandWeightedShare = 0;

  for (const { totalShare, totalCitations } of byBrand.values()) {
    if (totalCitations === 0) continue;
    grandWeightedShare += totalShare;
    grandTotalCitations += totalCitations;
  }

  const weightedShare = grandTotalCitations > 0 ? grandWeightedShare / grandTotalCitations : 0;
  return { weightedShare, totalCitations: grandTotalCitations };
}

interface SentimentAgg {
  weightedScore: number;
  totalCount: number;
}

function aggregateSentimentRows(
  rows: Array<{ brandId: string; netSentimentScore: string; totalCount: number }>
): SentimentAgg {
  let totalCount = 0;
  let weightedScore = 0;

  for (const row of rows) {
    if (row.totalCount === 0) continue;
    weightedScore += Number(row.netSentimentScore) * row.totalCount;
    totalCount += row.totalCount;
  }

  return {
    weightedScore: totalCount > 0 ? weightedScore / totalCount : 0,
    totalCount,
  };
}

function buildDelta(
  current: number,
  previous: number
): { delta: string | null; changeRate: string | null; direction: MetricBlock['direction'] } {
  if (previous === 0 && current === 0) {
    return { delta: null, changeRate: null, direction: null };
  }

  const result = computeDelta(current, previous);
  return {
    delta: result.delta.toFixed(2),
    changeRate: result.changeRate !== null ? result.changeRate.toFixed(2) : null,
    direction: result.direction,
  };
}

function emptyMetricBlock(): MetricBlock {
  return {
    current: '0',
    previous: null,
    delta: null,
    changeRate: null,
    direction: null,
    sparkline: [],
  };
}

// --- Sparkline helpers ---

async function fetchShareSparkline(
  workspaceId: string,
  promptSetId: string,
  brandIds: string[],
  from: string,
  to: string,
  granularity: 'day' | 'week' | 'month'
): Promise<SparklinePoint[]> {
  const truncExpr =
    granularity === 'day'
      ? recommendationShare.periodStart
      : sql<string>`date_trunc(${granularity}, ${recommendationShare.periodStart})::date`;

  const rows = await db
    .select({
      period: truncExpr,
      totalWeightedShare: sql<string>`sum(${recommendationShare.sharePercentage}::numeric * ${recommendationShare.citationCount})`,
      totalCitations: sql<number>`sum(${recommendationShare.citationCount})`,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.promptSetId, promptSetId),
        eq(recommendationShare.platformId, ALL_SENTINEL),
        eq(recommendationShare.locale, ALL_SENTINEL),
        inArray(recommendationShare.brandId, brandIds),
        gte(recommendationShare.periodStart, from),
        lte(recommendationShare.periodStart, to)
      )
    )
    .groupBy(truncExpr)
    .orderBy(truncExpr);

  return rows
    .filter((r) => r.totalCitations > 0)
    .map((r) => ({
      date: String(r.period),
      value: (Number(r.totalWeightedShare) / r.totalCitations).toFixed(2),
    }));
}

async function fetchCitationSparkline(
  workspaceId: string,
  promptSetId: string,
  brandIds: string[],
  from: string,
  to: string,
  granularity: 'day' | 'week' | 'month'
): Promise<SparklinePoint[]> {
  const truncExpr =
    granularity === 'day'
      ? recommendationShare.periodStart
      : sql<string>`date_trunc(${granularity}, ${recommendationShare.periodStart})::date`;

  const rows = await db
    .select({
      period: truncExpr,
      totalCitations: sql<number>`sum(${recommendationShare.citationCount})`,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.promptSetId, promptSetId),
        eq(recommendationShare.platformId, ALL_SENTINEL),
        eq(recommendationShare.locale, ALL_SENTINEL),
        inArray(recommendationShare.brandId, brandIds),
        gte(recommendationShare.periodStart, from),
        lte(recommendationShare.periodStart, to)
      )
    )
    .groupBy(truncExpr)
    .orderBy(truncExpr);

  return rows.map((r) => ({
    date: String(r.period),
    value: String(r.totalCitations),
  }));
}

async function fetchSentimentSparkline(
  workspaceId: string,
  promptSetId: string,
  brandIds: string[],
  from: string,
  to: string,
  granularity: 'day' | 'week' | 'month'
): Promise<SparklinePoint[]> {
  const truncExpr =
    granularity === 'day'
      ? sentimentAggregate.periodStart
      : sql<string>`date_trunc(${granularity}, ${sentimentAggregate.periodStart})::date`;

  const rows = await db
    .select({
      period: truncExpr,
      totalWeightedScore: sql<string>`sum(${sentimentAggregate.netSentimentScore}::numeric * ${sentimentAggregate.totalCount})`,
      totalCount: sql<number>`sum(${sentimentAggregate.totalCount})`,
    })
    .from(sentimentAggregate)
    .where(
      and(
        eq(sentimentAggregate.workspaceId, workspaceId),
        eq(sentimentAggregate.promptSetId, promptSetId),
        eq(sentimentAggregate.platformId, ALL_SENTINEL),
        eq(sentimentAggregate.locale, ALL_SENTINEL),
        inArray(sentimentAggregate.brandId, brandIds),
        gte(sentimentAggregate.periodStart, from),
        lte(sentimentAggregate.periodStart, to)
      )
    )
    .groupBy(truncExpr)
    .orderBy(truncExpr);

  return rows
    .filter((r) => r.totalCount > 0)
    .map((r) => ({
      date: String(r.period),
      value: (Number(r.totalWeightedScore) / r.totalCount).toFixed(2),
    }));
}

// --- Commercial trend enrichment ---

async function fetchTrendEnrichment(
  workspaceId: string,
  promptSetId: string,
  brandIds: string[],
  from: string,
  to: string
): Promise<DashboardTrends | null> {
  const metrics = ['recommendation_share', 'sentiment', 'citation_count'];

  const rows = await db
    .select({
      metric: trendSnapshot.metric,
      isSignificant: trendSnapshot.isSignificant,
      pValue: trendSnapshot.pValue,
      delta: trendSnapshot.delta,
      isAnomaly: trendSnapshot.isAnomaly,
      value: trendSnapshot.value,
      ewmaUpper: trendSnapshot.ewmaUpper,
      ewmaLower: trendSnapshot.ewmaLower,
    })
    .from(trendSnapshot)
    .where(
      and(
        eq(trendSnapshot.workspaceId, workspaceId),
        eq(trendSnapshot.promptSetId, promptSetId),
        eq(trendSnapshot.platformId, ALL_SENTINEL),
        eq(trendSnapshot.locale, ALL_SENTINEL),
        inArray(trendSnapshot.brandId, brandIds),
        inArray(trendSnapshot.metric, metrics),
        gte(trendSnapshot.periodStart, from),
        lte(trendSnapshot.periodStart, to)
      )
    )
    .orderBy(desc(trendSnapshot.periodStart));

  const significantChanges: DashboardTrends['significantChanges'] = [];
  const anomalies: DashboardTrends['anomalies'] = [];
  const seenSignificant = new Set<string>();
  const seenAnomalies = new Set<string>();

  for (const row of rows) {
    if (row.isSignificant && row.pValue && row.delta && !seenSignificant.has(row.metric)) {
      seenSignificant.add(row.metric);
      significantChanges.push({
        metric: row.metric,
        direction: Number(row.delta) > 0 ? 'up' : 'down',
        pValue: Number(row.pValue),
      });
    }

    if (row.isAnomaly && row.ewmaUpper && row.ewmaLower && !seenAnomalies.has(row.metric)) {
      seenAnomalies.add(row.metric);
      anomalies.push({
        metric: row.metric,
        value: String(row.value),
        expectedRange: {
          lower: String(row.ewmaLower),
          upper: String(row.ewmaUpper),
        },
      });
    }
  }

  if (significantChanges.length === 0 && anomalies.length === 0) return null;

  return { significantChanges, anomalies };
}
