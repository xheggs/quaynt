import { db } from '@/lib/db';
import { trendSnapshot } from './trend-snapshot.schema';
import {
  generatePeriods,
  queryRecommendationSharePeriods,
  querySentimentPeriods,
  queryPositionPeriods,
  queryFirstMentionRatePeriods,
  queryCitationCountPeriods,
  queryOpportunityCountPeriods,
} from './trend.service';
import {
  computeEWMA,
  computeControlLimits,
  detectAnomaly,
  computeDelta,
  computeSignificance,
  computeCredibleInterval,
} from './trend.stats';
import type { TrendMetric, TrendPeriod } from './trend.types';

const ALL_SENTINEL = '_all';

/** Metrics where significance testing uses two-proportion z-test */
const PROPORTION_METRICS = new Set<TrendMetric>([
  'recommendation_share',
  'first_mention_rate',
  'sentiment',
]);

/** Metrics where significance testing is not meaningful */
const SKIP_SIGNIFICANCE_METRICS = new Set<TrendMetric>(['average_position']);

export interface TrendSnapshotComputeInput {
  workspaceId: string;
  promptSetId: string;
  brandId: string;
  metric: TrendMetric;
  period: TrendPeriod;
  platformId?: string;
  locale?: string;
}

export async function computeTrendSnapshots(
  input: TrendSnapshotComputeInput
): Promise<{ changed: boolean; anomalyCount: number }> {
  const { workspaceId, promptSetId, brandId, metric, period } = input;
  const platformId = input.platformId ?? ALL_SENTINEL;
  const locale = input.locale ?? ALL_SENTINEL;

  // Determine period range: current + N historical periods for EWMA
  const now = new Date();
  const historyCount = period === 'weekly' ? 12 : 6;
  const historyStart = new Date(now);
  if (period === 'weekly') {
    historyStart.setUTCDate(historyStart.getUTCDate() - historyCount * 7);
  } else {
    historyStart.setUTCMonth(historyStart.getUTCMonth() - historyCount);
  }

  const from = historyStart.toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const periods = generatePeriods(from, to, period);

  if (periods.length === 0) {
    return { changed: false, anomalyCount: 0 };
  }

  // Query metric data
  const periodValues = await queryMetricForCompute(
    workspaceId,
    brandId,
    promptSetId,
    platformId,
    locale,
    metric,
    periods
  );

  // Build value array aligned with periods
  const values: (number | null)[] = [];
  const sampleSizes: number[] = [];
  const counts: { count: number; total: number }[] = [];

  for (const p of periods) {
    const pv = periodValues.get(p.start);
    if (pv) {
      values.push(pv.value);
      sampleSizes.push(pv.dataPoints);
      counts.push({
        count: pv.citationCount ?? 0,
        total: pv.totalCitations ?? 0,
      });
    } else {
      values.push(null);
      sampleSizes.push(0);
      counts.push({ count: 0, total: 0 });
    }
  }

  // Filter out nulls for EWMA computation
  const nonNullIndices = values.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0);
  const nonNullValues = nonNullIndices.map((i) => values[i] as number);

  if (nonNullValues.length === 0) {
    return { changed: false, anomalyCount: 0 };
  }

  // Compute EWMA and control limits
  const ewma = computeEWMA(nonNullValues);
  const { upper, lower } = computeControlLimits(ewma);

  // Map EWMA back to full period indices
  const ewmaMap = new Map<number, { ewma: number; upper: number; lower: number }>();
  for (let j = 0; j < nonNullIndices.length; j++) {
    ewmaMap.set(nonNullIndices[j], { ewma: ewma[j], upper: upper[j], lower: lower[j] });
  }

  // Build snapshot rows
  let changed = false;
  let anomalyCount = 0;
  const insufficientHistory = nonNullValues.length < 4;

  for (let i = 0; i < periods.length; i++) {
    const value = values[i];
    if (value === null) continue;

    const p = periods[i];
    const ewmaData = ewmaMap.get(i);
    const prevIndex = findPreviousNonNull(values, i);
    const prevValue = prevIndex !== null ? values[prevIndex] : null;

    // Delta computation
    let delta: number | null = null;
    let changeRate: number | null = null;
    if (prevValue !== null) {
      const d = computeDelta(value, prevValue);
      delta = d.delta;
      changeRate = d.changeRate;
    }

    // Anomaly detection
    let isAnomaly = false;
    let anomalyDirection: 'above' | 'below' | null = null;
    if (ewmaData && !insufficientHistory && isFinite(ewmaData.upper) && isFinite(ewmaData.lower)) {
      const anomaly = detectAnomaly(value, ewmaData.ewma, ewmaData.upper, ewmaData.lower);
      isAnomaly = anomaly.isAnomaly;
      anomalyDirection = anomaly.direction;
      if (isAnomaly) anomalyCount++;
    }

    // Significance testing
    let isSignificant: boolean | null = null;
    let pValue: number | null = null;
    let confidenceLower: number | null = null;
    let confidenceUpper: number | null = null;

    if (!insufficientHistory && prevIndex !== null) {
      if (PROPORTION_METRICS.has(metric)) {
        const sig = computeSignificance(
          counts[i].count,
          counts[i].total,
          counts[prevIndex].count,
          counts[prevIndex].total
        );
        isSignificant = sig.isSignificant;
        pValue = sig.pValue;

        if (counts[i].total > 0) {
          const ci = computeCredibleInterval(counts[i].count, counts[i].total);
          confidenceLower = ci.lower;
          confidenceUpper = ci.upper;
        }
      } else if (!SKIP_SIGNIFICANCE_METRICS.has(metric)) {
        // Count metrics: null significance (Poisson test deferred)
        isSignificant = null;
        pValue = null;
      }
    }

    // Upsert snapshot
    const row = {
      workspaceId,
      brandId,
      promptSetId,
      platformId,
      locale,
      metric,
      period,
      periodStart: p.start,
      periodEnd: p.end,
      value: value.toFixed(4),
      previousValue: prevValue !== null ? prevValue.toFixed(4) : null,
      delta: delta !== null ? delta.toFixed(4) : null,
      changeRate: changeRate !== null ? changeRate.toFixed(4) : null,
      ewmaValue: ewmaData ? ewmaData.ewma.toFixed(4) : null,
      ewmaUpper: ewmaData && isFinite(ewmaData.upper) ? ewmaData.upper.toFixed(4) : null,
      ewmaLower: ewmaData && isFinite(ewmaData.lower) ? ewmaData.lower.toFixed(4) : null,
      isAnomaly,
      anomalyDirection,
      isSignificant,
      pValue: pValue !== null ? pValue.toFixed(4) : null,
      confidenceLower: confidenceLower !== null ? confidenceLower.toFixed(4) : null,
      confidenceUpper: confidenceUpper !== null ? confidenceUpper.toFixed(4) : null,
      sampleSize: sampleSizes[i],
    };

    const result = await db
      .insert(trendSnapshot)
      .values(row)
      .onConflictDoUpdate({
        target: [
          trendSnapshot.workspaceId,
          trendSnapshot.promptSetId,
          trendSnapshot.brandId,
          trendSnapshot.platformId,
          trendSnapshot.locale,
          trendSnapshot.metric,
          trendSnapshot.period,
          trendSnapshot.periodStart,
        ],
        set: {
          ...row,
          updatedAt: new Date(),
        },
      })
      .returning({ id: trendSnapshot.id });

    if (result.length > 0) {
      changed = true;
    }
  }

  return { changed, anomalyCount };
}

// --- Helpers ---

function findPreviousNonNull(values: (number | null)[], currentIndex: number): number | null {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (values[i] !== null) return i;
  }
  return null;
}

async function queryMetricForCompute(
  workspaceId: string,
  brandId: string,
  promptSetId: string,
  platformId: string,
  locale: string,
  metric: TrendMetric,
  periods: { start: string; end: string }[]
) {
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
