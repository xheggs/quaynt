import { getScoreTrend } from '@/modules/visibility/geo-score.service';
import { getScoreTrend as getSeoScoreTrend } from '@/modules/visibility/seo-score.service';
import { getDualQueries, getDualScore } from '@/modules/visibility/dual-score.service';
import { capSparklinePoints } from './report-data.utils';
import type {
  SparklinePoint,
  GeoScoreMetricBlock,
  GeoScoreFactorBlock,
  SeoScoreMetricBlock,
  SeoScoreFactorBlock,
  DualScoreMetricBlock,
  DualScoreGapQueryBlock,
} from './report-data.types';

interface PeriodRange {
  from: string;
  to: string;
}

/**
 * Fetches GEO Score data for a brand. Returns null when no snapshot exists.
 */
export async function fetchGeoScoreMetric(
  workspaceId: string,
  brandId: string,
  currentPeriod: PeriodRange
): Promise<GeoScoreMetricBlock | null> {
  const { snapshots, trend } = await getScoreTrend(
    workspaceId,
    brandId,
    currentPeriod.from,
    currentPeriod.to,
    'monthly'
  );

  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1];
  const sparkline: SparklinePoint[] = capSparklinePoints(
    snapshots
      .filter((s) => s.composite !== null)
      .map((s) => ({ date: s.periodStart, value: String(s.composite) }))
  );

  return {
    composite: latest.composite,
    compositeRaw: latest.compositeRaw,
    displayCapApplied: latest.displayCapApplied,
    formulaVersion: latest.formulaVersion,
    factors: latest.factors.map<GeoScoreFactorBlock>((f) => ({
      id: f.id,
      score: f.score,
      weight: f.weight,
      status: f.status,
    })),
    periodStart: latest.periodStart,
    periodEnd: latest.periodEnd,
    trend: { delta: trend.delta, direction: trend.direction },
    sparkline,
  };
}

/**
 * Fetches SEO Score data for a brand. Returns null when no snapshot exists.
 */
export async function fetchSeoScoreMetric(
  workspaceId: string,
  brandId: string,
  currentPeriod: PeriodRange
): Promise<SeoScoreMetricBlock | null> {
  const { snapshots, trend } = await getSeoScoreTrend(
    workspaceId,
    brandId,
    currentPeriod.from,
    currentPeriod.to,
    'monthly'
  );

  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1];
  const sparkline: SparklinePoint[] = capSparklinePoints(
    snapshots
      .filter((s) => s.composite !== null)
      .map((s) => ({ date: s.periodStart, value: String(s.composite) }))
  );

  return {
    composite: latest.composite,
    compositeRaw: latest.compositeRaw,
    displayCapApplied: latest.displayCapApplied,
    formulaVersion: latest.formulaVersion,
    factors: latest.factors.map<SeoScoreFactorBlock>((f) => ({
      id: f.id,
      score: f.score,
      weight: f.weight,
      status: f.status,
    })),
    periodStart: latest.periodStart,
    periodEnd: latest.periodEnd,
    querySetSize: latest.querySetSize,
    dataQualityAdvisories: latest.dataQualityAdvisories,
    code: latest.code,
    trend: { delta: trend.delta, direction: trend.direction },
    sparkline,
  };
}

/**
 * Fetches the Dual Score view for a brand: both composites, their correlation
 * over the trailing window, and the top-20 per-query gap signals.
 *
 * The `dualScore` report section is derived (not a metric), so this resolver
 * is exposed for PDF templates to call directly when the section is enabled.
 * Returns null when both SEO and GEO snapshots are missing.
 */
export async function fetchDualScoreMetric(
  workspaceId: string,
  brandId: string,
  currentPeriod: PeriodRange,
  granularity: 'weekly' | 'monthly' = 'monthly'
): Promise<DualScoreMetricBlock | null> {
  const dual = await getDualScore(workspaceId, brandId, currentPeriod.to, granularity);

  if (!dual.seo && !dual.geo) return null;

  const queries = await getDualQueries(workspaceId, brandId, currentPeriod.from, currentPeriod.to, {
    pagination: { page: 1, limit: 20 },
    sort: 'gapSignal',
  });

  const topGapQueries: DualScoreGapQueryBlock[] = queries.rows
    .filter((r) => r.gapSignal !== 'no_signal')
    .slice(0, 20)
    .map((r) => ({
      query: r.query,
      impressions: r.impressions,
      aioCitationCount: r.aioCitationCount,
      gapSignal: r.gapSignal,
    }));

  return {
    seoComposite: dual.seo?.composite ?? null,
    geoComposite: dual.geo?.composite ?? null,
    seoDelta: dual.seo?.delta ?? null,
    geoDelta: dual.geo?.delta ?? null,
    correlation: {
      rho: dual.correlation.rho,
      label: dual.correlation.label,
      direction: dual.correlation.direction,
      n: dual.correlation.n,
      window: dual.correlation.window,
    },
    topGapQueries,
    dataQualityAdvisories: dual.dataQualityAdvisories,
    codes: dual.codes,
  };
}
