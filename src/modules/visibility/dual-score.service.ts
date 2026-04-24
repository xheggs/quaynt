/**
 * Dual Score service — derived, read-only analytics layer over the GEO Score
 * (6.4) and SEO Score (6.5a) snapshots plus GSC + citation data.
 *
 * No persistence. All computation is query-time. Scoped by workspace; callers
 * must verify brand membership before invoking these functions.
 *
 * See docs/architecture/dual-score.md for the methodology.
 */

import * as geoScoreService from './geo-score.service';
import * as seoScoreService from './seo-score.service';
import { computeSpearmanRho } from './trend.stats';
import {
  DUAL_CORRELATION_LABEL_MIN_SAMPLES,
  DUAL_CORRELATION_MIN_SAMPLES,
  DUAL_CORRELATION_WINDOW,
  correlationDirection,
  labelCorrelation,
} from './dual-score.formula';
import type {
  DualCombinedRecommendation,
  DualCombinedRecommendationsResult,
  DualHistoryPair,
  DualHistoryResult,
  DualScoreCode,
  DualScoreResult,
  DualScoreSidePayload,
} from './dual-score.types';
import type { DataQualityAdvisory } from './seo-score.types';
import type { FactorResult, Granularity } from './geo-score.types';
import type { SeoFactorResult } from './seo-score.types';

// Re-export query-set helpers from ./dual-score.queries to keep API routes that
// import { getDualQueries } from '@/modules/visibility/dual-score.service' working.
export { getDualQueries } from './dual-score.queries';
export type { DualQuerySortKey, GetDualQueriesOptions } from './dual-score.queries';

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function periodStartAtOrBefore(at: string, granularity: Granularity): string {
  const d = new Date(`${at}T00:00:00Z`);
  if (granularity === 'weekly') {
    const day = d.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + mondayOffset);
    return fmt(d);
  }
  return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

function shiftPeriodStart(periodStart: string, granularity: Granularity, steps: number): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  if (granularity === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7 * steps);
  } else {
    d.setUTCMonth(d.getUTCMonth() + steps);
  }
  return fmt(d);
}

/**
 * Trailing window of aligned period starts for correlation. Includes the
 * period containing `at` (inclusive) and walks back DUAL_CORRELATION_WINDOW
 * steps.
 */
function correlationWindow(at: string, granularity: Granularity): { from: string; to: string } {
  const to = periodStartAtOrBefore(at, granularity);
  const steps = DUAL_CORRELATION_WINDOW[granularity] - 1;
  const from = shiftPeriodStart(to, granularity, -steps);
  return { from, to };
}

/**
 * Inner-join snapshot arrays by periodStart. Drops missing pairs — never
 * zero-fills. Ordered ascending by periodStart.
 */
function alignSnapshots<
  S extends { periodStart: string; composite: number | null },
  G extends { periodStart: string; composite: number | null },
>(seo: S[], geo: G[]): Array<{ periodStart: string; seo: S; geo: G }> {
  const seoByStart = new Map(seo.map((s) => [s.periodStart, s]));
  const pairs: Array<{ periodStart: string; seo: S; geo: G }> = [];
  for (const g of geo) {
    const s = seoByStart.get(g.periodStart);
    if (s) pairs.push({ periodStart: g.periodStart, seo: s, geo: g });
  }
  pairs.sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
  return pairs;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDualScore(
  workspaceId: string,
  brandId: string,
  at: string,
  granularity: Granularity
): Promise<DualScoreResult> {
  const [latestSeo, latestGeo] = await Promise.all([
    seoScoreService.getLatestSnapshot(workspaceId, brandId, granularity),
    geoScoreService.getLatestSnapshot(workspaceId, brandId, granularity),
  ]);

  const codes: DualScoreCode[] = [];
  if (!latestSeo) codes.push('NO_SEO_SNAPSHOTS');
  if (!latestGeo) codes.push('NO_GEO_SNAPSHOTS');
  if (!latestSeo && !latestGeo) codes.push('NO_SNAPSHOTS');

  const window = correlationWindow(at, granularity);

  const [windowSeo, windowGeo] = await Promise.all([
    seoScoreService.listSnapshots(workspaceId, brandId, window.from, window.to, granularity),
    geoScoreService.listSnapshots(workspaceId, brandId, window.from, window.to, granularity),
  ]);

  const pairs = alignSnapshots(windowSeo, windowGeo);
  const pairValues: Array<[number, number]> = pairs
    .filter((p) => p.seo.composite !== null && p.geo.composite !== null)
    .map((p) => [p.seo.composite as number, p.geo.composite as number]);

  const raw = computeSpearmanRho(pairValues);
  const label = labelCorrelation(raw.rho, raw.n);
  const belowFloor = raw.n < DUAL_CORRELATION_MIN_SAMPLES;
  // Below the minimum-samples floor we do not expose a numeric coefficient at
  // all — see the methodology doc. `n` is still surfaced so the UI can show
  // how far the window is from the threshold.
  const rho = belowFloor ? null : raw.rho;
  const direction = belowFloor ? null : correlationDirection(raw.rho);
  const correlationCode = belowFloor ? 'insufficientData' : null;
  if (correlationCode) codes.push('INSUFFICIENT_WINDOW');

  const advisoriesSet = new Set<DataQualityAdvisory>();
  for (const s of windowSeo) {
    for (const adv of s.dataQualityAdvisories) advisoriesSet.add(adv);
  }

  const seoDelta = computeTrailingDelta(windowSeo);
  const geoDelta = computeTrailingDelta(windowGeo);

  const seoPayload: DualScoreSidePayload<SeoFactorResult> | null = latestSeo
    ? {
        composite: latestSeo.composite,
        compositeRaw: latestSeo.compositeRaw,
        displayCapApplied: latestSeo.displayCapApplied,
        delta: seoDelta,
        formulaVersion: latestSeo.formulaVersion,
        factors: latestSeo.factors,
        contributingPromptSetIds: latestSeo.contributingPromptSetIds,
        periodStart: latestSeo.periodStart,
        periodEnd: latestSeo.periodEnd,
        code: latestSeo.code,
      }
    : null;

  const geoPayload: DualScoreSidePayload<FactorResult> | null = latestGeo
    ? {
        composite: latestGeo.composite,
        compositeRaw: latestGeo.compositeRaw,
        displayCapApplied: latestGeo.displayCapApplied,
        delta: geoDelta,
        formulaVersion: latestGeo.formulaVersion,
        factors: latestGeo.factors,
        contributingPromptSetIds: latestGeo.contributingPromptSetIds,
        periodStart: latestGeo.periodStart,
        periodEnd: latestGeo.periodEnd,
      }
    : null;

  return {
    workspaceId,
    brandId,
    at,
    granularity,
    seo: seoPayload,
    geo: geoPayload,
    correlation: {
      rho,
      label,
      direction,
      n: raw.n,
      code: correlationCode,
      window,
    },
    dataQualityAdvisories: Array.from(advisoriesSet),
    codes,
  };
}

function computeTrailingDelta(snapshots: Array<{ composite: number | null }>): number | null {
  const composites = snapshots.map((s) => s.composite).filter((v): v is number => v !== null);
  if (composites.length < 2) return null;
  return composites[composites.length - 1] - composites[composites.length - 2];
}

export async function getDualHistory(
  workspaceId: string,
  brandId: string,
  from: string,
  to: string,
  granularity: Granularity
): Promise<DualHistoryResult> {
  const [seoSnapshots, geoSnapshots] = await Promise.all([
    seoScoreService.listSnapshots(workspaceId, brandId, from, to, granularity),
    geoScoreService.listSnapshots(workspaceId, brandId, from, to, granularity),
  ]);

  const pairs = alignSnapshots(seoSnapshots, geoSnapshots);
  const history: DualHistoryPair[] = [];
  let prevSeo: number | null = null;
  let prevGeo: number | null = null;
  for (const p of pairs) {
    const seoVal = p.seo.composite;
    const geoVal = p.geo.composite;
    history.push({
      periodStart: p.periodStart,
      periodEnd: p.geo.periodEnd,
      seo: seoVal,
      geo: geoVal,
      seoDelta: seoVal !== null && prevSeo !== null ? seoVal - prevSeo : null,
      geoDelta: geoVal !== null && prevGeo !== null ? geoVal - prevGeo : null,
    });
    if (seoVal !== null) prevSeo = seoVal;
    if (geoVal !== null) prevGeo = geoVal;
  }

  const formulaVersionChanges: DualHistoryResult['formulaVersionChanges'] = [];
  accumulateFormulaVersionChanges(seoSnapshots, 'seo', formulaVersionChanges);
  accumulateFormulaVersionChanges(geoSnapshots, 'geo', formulaVersionChanges);

  return {
    pairs: history,
    granularity,
    formulaVersionChanges,
  };
}

function accumulateFormulaVersionChanges(
  snapshots: Array<{ periodStart: string; formulaVersion: number }>,
  source: 'seo' | 'geo',
  out: Array<{ source: 'seo' | 'geo'; periodStart: string; fromVersion: number; toVersion: number }>
): void {
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    if (prev.formulaVersion !== cur.formulaVersion) {
      out.push({
        source,
        periodStart: cur.periodStart,
        fromVersion: prev.formulaVersion,
        toVersion: cur.formulaVersion,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Per-query drill-in
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Combined recommendations
// ---------------------------------------------------------------------------

export async function getCombinedRecommendations(
  workspaceId: string,
  brandId: string,
  periodStart: string,
  periodEnd: string,
  granularity: Granularity
): Promise<DualCombinedRecommendationsResult> {
  const [seoResult, geoResult] = await Promise.allSettled([
    seoScoreService.getRecommendations(workspaceId, brandId, periodStart, periodEnd, granularity),
    geoScoreService.getRecommendations(workspaceId, brandId, periodStart, periodEnd, granularity),
  ]);

  const seoOk = seoResult.status === 'fulfilled';
  const geoOk = geoResult.status === 'fulfilled';

  if (!seoOk && !geoOk) {
    throw new Error('Both recommendation sources failed');
  }

  const recommendations: DualCombinedRecommendation[] = [];
  if (seoOk) {
    for (const r of seoResult.value) {
      recommendations.push({
        source: 'seo',
        factorId: r.factorId,
        severity: r.severity,
        titleKey: r.titleKey,
        descriptionKey: r.descriptionKey,
        estimatedPointDelta: r.estimatedPointDelta,
      });
    }
  }
  if (geoOk) {
    for (const r of geoResult.value) {
      recommendations.push({
        source: 'geo',
        factorId: r.factorId,
        severity: r.severity,
        titleKey: r.titleKey,
        descriptionKey: r.descriptionKey,
        estimatedPointDelta: r.estimatedPointDelta,
      });
    }
  }
  recommendations.sort((a, b) => b.estimatedPointDelta - a.estimatedPointDelta);

  const partial = !(seoOk && geoOk);
  const failedSource = partial ? (!seoOk ? 'seo' : 'geo') : null;

  return { recommendations, partial, failedSource };
}

// ---------------------------------------------------------------------------
// Utility: verify brand membership (re-exported for route convenience).
// ---------------------------------------------------------------------------

export { DUAL_CORRELATION_LABEL_MIN_SAMPLES, DUAL_CORRELATION_MIN_SAMPLES };
