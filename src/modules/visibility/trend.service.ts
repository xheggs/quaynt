import { eq, and, gte, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { recommendationShare } from './recommendation-share.schema';
import { sentimentAggregate } from './sentiment-aggregate.schema';
import { positionAggregate } from './position-aggregate.schema';
import { opportunity } from './opportunity.schema';
import { trendSnapshot } from './trend-snapshot.schema';
import { brand } from '@/modules/brands/brand.schema';
import { promptSet } from '@/modules/prompt-sets/prompt-set.schema';
import { computeDelta, computeEWMA, computeOverallDirection } from './trend.stats';
import type {
  TrendMetric,
  TrendFilters,
  TrendDataPoint,
  TrendDataPointCommercial,
  TrendResult,
  TrendSummary,
} from './trend.types';

const ALL_SENTINEL = '_all';

/** Count metrics include 0 for empty periods; rate metrics exclude gaps. */
const COUNT_METRICS = new Set<TrendMetric>(['citation_count', 'opportunity_count']);

interface PeriodRange {
  start: string;
  end: string;
}

interface PeriodValue {
  value: number;
  citationCount?: number;
  totalCitations?: number;
  dataPoints: number;
}

// --- Period generation ---

export function generatePeriods(
  from: string,
  to: string,
  period: 'weekly' | 'monthly'
): PeriodRange[] {
  const periods: PeriodRange[] = [];
  const endDate = new Date(to + 'T00:00:00Z');

  if (period === 'weekly') {
    // Align to ISO week (Monday)
    const current = new Date(from + 'T00:00:00Z');
    const day = current.getUTCDay();
    // Move to Monday of the same or preceding week
    const mondayOffset = day === 0 ? -6 : 1 - day;
    current.setUTCDate(current.getUTCDate() + mondayOffset);

    while (current <= endDate) {
      const start = formatDate(current);
      const sunday = new Date(current);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      const end = formatDate(sunday);
      periods.push({ start, end });
      current.setUTCDate(current.getUTCDate() + 7);
    }
  } else {
    // Monthly: align to 1st of month
    const current = new Date(from + 'T00:00:00Z');
    current.setUTCDate(1);

    while (current <= endDate) {
      const start = formatDate(current);
      const lastDay = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
      const end = formatDate(lastDay);
      periods.push({ start, end });
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  return periods;
}

// --- Metric-specific query functions ---

export async function queryRecommendationSharePeriods(
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  periods: PeriodRange[]
): Promise<Map<string, PeriodValue>> {
  if (periods.length === 0) return new Map();

  const minDate = periods[0].start;
  const maxDate = periods[periods.length - 1].end;

  const conditions: SQL[] = [
    eq(recommendationShare.workspaceId, workspaceId),
    eq(recommendationShare.brandId, brandId),
    eq(recommendationShare.promptSetId, promptSetId),
    eq(recommendationShare.platformId, platformId),
    eq(recommendationShare.locale, locale),
    gte(recommendationShare.periodStart, minDate),
    lte(recommendationShare.periodStart, maxDate),
  ];

  const rows = await db
    .select({
      periodStart: recommendationShare.periodStart,
      citationCount: recommendationShare.citationCount,
      totalCitations: recommendationShare.totalCitations,
    })
    .from(recommendationShare)
    .where(and(...conditions));

  return aggregateIntoPeriods(periods, rows, (periodRows) => {
    const citationCount = periodRows.reduce((s, r) => s + r.citationCount, 0);
    const totalCitations = periodRows.reduce((s, r) => s + r.totalCitations, 0);
    const value = totalCitations > 0 ? (citationCount / totalCitations) * 100 : 0;
    return { value, citationCount, totalCitations, dataPoints: periodRows.length };
  });
}

export async function querySentimentPeriods(
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  periods: PeriodRange[]
): Promise<Map<string, PeriodValue>> {
  if (periods.length === 0) return new Map();

  const minDate = periods[0].start;
  const maxDate = periods[periods.length - 1].end;

  const rows = await db
    .select({
      periodStart: sentimentAggregate.periodStart,
      positiveCount: sentimentAggregate.positiveCount,
      negativeCount: sentimentAggregate.negativeCount,
      totalCount: sentimentAggregate.totalCount,
    })
    .from(sentimentAggregate)
    .where(
      and(
        eq(sentimentAggregate.workspaceId, workspaceId),
        eq(sentimentAggregate.brandId, brandId),
        eq(sentimentAggregate.promptSetId, promptSetId),
        eq(sentimentAggregate.platformId, platformId),
        eq(sentimentAggregate.locale, locale),
        gte(sentimentAggregate.periodStart, minDate),
        lte(sentimentAggregate.periodStart, maxDate)
      )
    );

  return aggregateIntoPeriods(periods, rows, (periodRows) => {
    const positive = periodRows.reduce((s, r) => s + r.positiveCount, 0);
    const negative = periodRows.reduce((s, r) => s + r.negativeCount, 0);
    const total = periodRows.reduce((s, r) => s + r.totalCount, 0);
    const value = total > 0 ? ((positive - negative) / total) * 100 : 0;
    return { value, dataPoints: periodRows.length };
  });
}

export async function queryPositionPeriods(
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  periods: PeriodRange[]
): Promise<Map<string, PeriodValue>> {
  if (periods.length === 0) return new Map();

  const minDate = periods[0].start;
  const maxDate = periods[periods.length - 1].end;

  const rows = await db
    .select({
      periodStart: positionAggregate.periodStart,
      averagePosition: positionAggregate.averagePosition,
      citationCount: positionAggregate.citationCount,
    })
    .from(positionAggregate)
    .where(
      and(
        eq(positionAggregate.workspaceId, workspaceId),
        eq(positionAggregate.brandId, brandId),
        eq(positionAggregate.promptSetId, promptSetId),
        eq(positionAggregate.platformId, platformId),
        eq(positionAggregate.locale, locale),
        gte(positionAggregate.periodStart, minDate),
        lte(positionAggregate.periodStart, maxDate)
      )
    );

  return aggregateIntoPeriods(periods, rows, (periodRows) => {
    // Citation-weighted average position
    const totalCitations = periodRows.reduce((s, r) => s + r.citationCount, 0);
    if (totalCitations === 0) return { value: 0, dataPoints: periodRows.length };
    const weightedSum = periodRows.reduce(
      (s, r) => s + parseFloat(r.averagePosition) * r.citationCount,
      0
    );
    return { value: weightedSum / totalCitations, dataPoints: periodRows.length };
  });
}

export async function queryFirstMentionRatePeriods(
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  periods: PeriodRange[]
): Promise<Map<string, PeriodValue>> {
  if (periods.length === 0) return new Map();

  const minDate = periods[0].start;
  const maxDate = periods[periods.length - 1].end;

  const rows = await db
    .select({
      periodStart: positionAggregate.periodStart,
      firstMentionCount: positionAggregate.firstMentionCount,
      citationCount: positionAggregate.citationCount,
    })
    .from(positionAggregate)
    .where(
      and(
        eq(positionAggregate.workspaceId, workspaceId),
        eq(positionAggregate.brandId, brandId),
        eq(positionAggregate.promptSetId, promptSetId),
        eq(positionAggregate.platformId, platformId),
        eq(positionAggregate.locale, locale),
        gte(positionAggregate.periodStart, minDate),
        lte(positionAggregate.periodStart, maxDate)
      )
    );

  return aggregateIntoPeriods(periods, rows, (periodRows) => {
    const firstMentions = periodRows.reduce((s, r) => s + r.firstMentionCount, 0);
    const totalCitations = periodRows.reduce((s, r) => s + r.citationCount, 0);
    const value = totalCitations > 0 ? (firstMentions / totalCitations) * 100 : 0;
    return {
      value,
      citationCount: totalCitations,
      totalCitations: totalCitations,
      dataPoints: periodRows.length,
    };
  });
}

export async function queryCitationCountPeriods(
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  periods: PeriodRange[]
): Promise<Map<string, PeriodValue>> {
  if (periods.length === 0) return new Map();

  const minDate = periods[0].start;
  const maxDate = periods[periods.length - 1].end;

  const rows = await db
    .select({
      periodStart: recommendationShare.periodStart,
      citationCount: recommendationShare.citationCount,
    })
    .from(recommendationShare)
    .where(
      and(
        eq(recommendationShare.workspaceId, workspaceId),
        eq(recommendationShare.brandId, brandId),
        eq(recommendationShare.promptSetId, promptSetId),
        eq(recommendationShare.platformId, platformId),
        eq(recommendationShare.locale, locale),
        gte(recommendationShare.periodStart, minDate),
        lte(recommendationShare.periodStart, maxDate)
      )
    );

  return aggregateIntoPeriods(periods, rows, (periodRows) => {
    const value = periodRows.reduce((s, r) => s + r.citationCount, 0);
    return { value, dataPoints: periodRows.length };
  });
}

export async function queryOpportunityCountPeriods(
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  periods: PeriodRange[]
): Promise<Map<string, PeriodValue>> {
  if (periods.length === 0) return new Map();

  const minDate = periods[0].start;
  const maxDate = periods[periods.length - 1].end;

  const rows = await db
    .select({
      periodStart: opportunity.periodStart,
      count: sql<number>`1`.as('count'),
    })
    .from(opportunity)
    .where(
      and(
        eq(opportunity.workspaceId, workspaceId),
        eq(opportunity.brandId, brandId),
        eq(opportunity.promptSetId, promptSetId),
        gte(opportunity.periodStart, minDate),
        lte(opportunity.periodStart, maxDate)
      )
    );

  return aggregateIntoPeriods(periods, rows, (periodRows) => {
    return { value: periodRows.length, dataPoints: periodRows.length > 0 ? 1 : 0 };
  });
}

// --- Main orchestrator ---

export async function getTrends(workspaceId: string, filters: TrendFilters): Promise<TrendResult> {
  const metric = filters.metric;
  const period = filters.period ?? 'weekly';
  const platformId = filters.platformId ?? ALL_SENTINEL;
  const locale = filters.locale ?? ALL_SENTINEL;
  const includeMovingAverage = filters.includeMovingAverage ?? true;

  // Default date range: last 12 weeks (weekly) or 6 months (monthly)
  const now = new Date();
  const defaultTo = formatDate(now);
  let defaultFrom: string;
  if (period === 'weekly') {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 12 * 7);
    defaultFrom = formatDate(d);
  } else {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - 6);
    defaultFrom = formatDate(d);
  }

  const from = filters.from ?? defaultFrom;
  const to = filters.to ?? defaultTo;

  const periods = generatePeriods(from, to, period);

  // Query metric data and resolve names in parallel
  const [periodValues, brandRow, promptSetRow] = await Promise.all([
    queryMetric(
      workspaceId,
      filters.brandId,
      filters.promptSetId,
      platformId,
      locale,
      metric,
      periods
    ),
    db
      .select({ name: brand.name })
      .from(brand)
      .where(and(eq(brand.id, filters.brandId), eq(brand.workspaceId, workspaceId)))
      .limit(1),
    db
      .select({ name: promptSet.name })
      .from(promptSet)
      .where(and(eq(promptSet.id, filters.promptSetId), eq(promptSet.workspaceId, workspaceId)))
      .limit(1),
  ]);

  const brandName = brandRow[0]?.name ?? '';
  const marketName = promptSetRow[0]?.name ?? '';

  // Build data points
  const isCountMetric = COUNT_METRICS.has(metric);
  const dataPoints: TrendDataPoint[] = [];
  const values: number[] = [];

  for (const p of periods) {
    const pv = periodValues.get(p.start);
    if (!pv && !isCountMetric) continue; // Skip gaps for rate metrics

    const value = pv?.value ?? 0;
    const dp = pv?.dataPoints ?? 0;
    values.push(value);

    const prev = dataPoints.length > 0 ? parseFloat(dataPoints[dataPoints.length - 1].value) : null;
    let delta: string | null = null;
    let changeRate: string | null = null;
    let direction: 'up' | 'down' | 'stable' | null = null;
    let previousValue: string | null = null;

    if (prev !== null) {
      const d = computeDelta(value, prev);
      delta = formatNumeric(d.delta);
      changeRate = d.changeRate !== null ? formatNumeric(d.changeRate) : null;
      direction = d.direction;
      previousValue = dataPoints[dataPoints.length - 1].value;
    }

    dataPoints.push({
      periodStart: p.start,
      periodEnd: p.end,
      value: formatNumeric(value),
      previousValue,
      delta,
      changeRate,
      direction,
      movingAverage: null,
      dataPoints: dp,
    });
  }

  // Compute EWMA moving averages
  if (includeMovingAverage && values.length > 0) {
    const ewma = computeEWMA(values);
    for (let i = 0; i < dataPoints.length; i++) {
      dataPoints[i].movingAverage = formatNumeric(ewma[i]);
    }
  }

  // Build summary
  const summary = buildSummary(dataPoints);

  // Commercial enrichment: merge pre-computed statistical fields
  if (env.QUAYNT_EDITION !== 'community' && dataPoints.length > 0) {
    await enrichWithCommercialData(
      dataPoints,
      workspaceId,
      filters.brandId,
      filters.promptSetId,
      platformId,
      locale,
      metric,
      period,
      from,
      to
    );
  }

  return {
    metric,
    brand: { brandId: filters.brandId, brandName: brandName },
    market: { promptSetId: filters.promptSetId, name: marketName },
    period,
    filters: { platformId, locale, from, to },
    dataPoints,
    summary,
  };
}

// --- Helpers ---

async function enrichWithCommercialData(
  dataPoints: TrendDataPoint[],
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  metric: TrendMetric,
  period: string,
  from: string,
  to: string
): Promise<void> {
  const snapshots = await db
    .select({
      periodStart: trendSnapshot.periodStart,
      isSignificant: trendSnapshot.isSignificant,
      pValue: trendSnapshot.pValue,
      confidenceLower: trendSnapshot.confidenceLower,
      confidenceUpper: trendSnapshot.confidenceUpper,
      isAnomaly: trendSnapshot.isAnomaly,
      anomalyDirection: trendSnapshot.anomalyDirection,
      ewmaUpper: trendSnapshot.ewmaUpper,
      ewmaLower: trendSnapshot.ewmaLower,
    })
    .from(trendSnapshot)
    .where(
      and(
        eq(trendSnapshot.workspaceId, workspaceId),
        eq(trendSnapshot.brandId, brandId),
        eq(trendSnapshot.promptSetId, promptSetId),
        eq(trendSnapshot.platformId, platformId),
        eq(trendSnapshot.locale, locale),
        eq(trendSnapshot.metric, metric),
        eq(trendSnapshot.period, period),
        gte(trendSnapshot.periodStart, from),
        lte(trendSnapshot.periodStart, to)
      )
    );

  const snapshotMap = new Map(snapshots.map((s) => [s.periodStart, s]));

  for (const dp of dataPoints) {
    const snap = snapshotMap.get(dp.periodStart);
    if (snap) {
      const commercial = dp as TrendDataPointCommercial;
      commercial.isSignificant = snap.isSignificant;
      commercial.pValue = snap.pValue ? parseFloat(snap.pValue) : null;
      commercial.confidenceInterval =
        snap.confidenceLower && snap.confidenceUpper
          ? { lower: snap.confidenceLower, upper: snap.confidenceUpper }
          : null;
      commercial.isAnomaly = snap.isAnomaly;
      commercial.anomalyDirection = snap.anomalyDirection as 'above' | 'below' | null;
      commercial.ewmaUpper = snap.ewmaUpper;
      commercial.ewmaLower = snap.ewmaLower;
    }
  }
}

function queryMetric(
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  metric: TrendMetric,
  periods: PeriodRange[]
): Promise<Map<string, PeriodValue>> {
  switch (metric) {
    case 'recommendation_share':
      return queryRecommendationSharePeriods(
        workspaceId,
        brandId,
        promptSetId,
        platformId,
        locale,
        periods
      );
    case 'sentiment':
      return querySentimentPeriods(workspaceId, brandId, promptSetId, platformId, locale, periods);
    case 'average_position':
      return queryPositionPeriods(workspaceId, brandId, promptSetId, platformId, locale, periods);
    case 'first_mention_rate':
      return queryFirstMentionRatePeriods(
        workspaceId,
        brandId,
        promptSetId,
        platformId,
        locale,
        periods
      );
    case 'citation_count':
      return queryCitationCountPeriods(
        workspaceId,
        brandId,
        promptSetId,
        platformId,
        locale,
        periods
      );
    case 'opportunity_count':
      return queryOpportunityCountPeriods(workspaceId, brandId, promptSetId, periods);
  }
}

function aggregateIntoPeriods<T extends { periodStart: string }>(
  periods: PeriodRange[],
  rows: T[],
  aggregate: (periodRows: T[]) => PeriodValue
): Map<string, PeriodValue> {
  const result = new Map<string, PeriodValue>();

  for (const period of periods) {
    const periodRows = rows.filter(
      (r) => r.periodStart >= period.start && r.periodStart <= period.end
    );
    if (periodRows.length > 0) {
      result.set(period.start, aggregate(periodRows));
    }
  }

  return result;
}

function buildSummary(dataPoints: TrendDataPoint[]): TrendSummary {
  if (dataPoints.length === 0) {
    return {
      latestValue: '0',
      latestDelta: null,
      latestDirection: null,
      overallDirection: null,
      overallChangeRate: null,
      periodCount: 0,
      dataPointCount: 0,
    };
  }

  const latest = dataPoints[dataPoints.length - 1];
  const first = dataPoints[0];
  const firstValue = parseFloat(first.value);
  const lastValue = parseFloat(latest.value);
  const totalDataPoints = dataPoints.reduce((s, d) => s + d.dataPoints, 0);

  let overallChangeRate: string | null = null;
  if (dataPoints.length > 1 && firstValue !== 0) {
    overallChangeRate = formatNumeric(((lastValue - firstValue) / firstValue) * 100);
  }

  return {
    latestValue: latest.value,
    latestDelta: latest.delta,
    latestDirection: latest.direction,
    overallDirection: dataPoints.length > 1 ? computeOverallDirection(firstValue, lastValue) : null,
    overallChangeRate,
    periodCount: dataPoints.length,
    dataPointCount: totalDataPoints,
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatNumeric(value: number): string {
  return parseFloat(value.toFixed(4)).toString();
}
