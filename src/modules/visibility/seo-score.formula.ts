/**
 * Pure scoring functions and calibration constants for the SEO Score composite.
 *
 * Single source of truth for weights, ceilings, and score composition rules.
 * Bumping `FORMULA_VERSION` triggers a migration-backed backfill (see
 * seo-score.handler). No I/O — fully unit-testable and deterministic.
 */

import type {
  DataQualityAdvisory,
  SeoFactorId,
  SeoFactorInputs,
  SeoFactorResult,
  SeoFactorStatus,
  SeoScoreComposite,
} from './seo-score.types';

export const FORMULA_VERSION = 1;

export const FACTOR_WEIGHTS: Record<SeoFactorId, number> = {
  impression_volume: 25,
  click_through_rate: 25,
  rank_quality: 30,
  aio_presence: 20,
};

// Calibration constants (see docs/architecture/seo-score.md).
// Revisit after 90 days of production data before tuning.
export const IMPRESSION_VOLUME_CEILING = 50_000;
export const CTR_CEILING = 0.3;
export const RANK_QUALITY_CURVE: Array<{ pos: number; score: number }> = [
  { pos: 1, score: 100 },
  { pos: 10, score: 50 },
  { pos: 30, score: 0 },
];

/**
 * Named GSC data-quality advisory windows. When a score's period overlaps a
 * window, the advisory id is attached to the result and persisted on the
 * snapshot so the UI can render a non-dismissible banner.
 *
 * Primary source for the 2025-05-13 → 2026-04-03 impression-logging bug:
 * Google Search Central — verify primary URL before merging and cite it in
 * docs/architecture/seo-score.md.
 */
export const GSC_ADVISORY_WINDOWS: Array<{
  id: DataQualityAdvisory;
  from: string;
  to: string;
}> = [{ id: 'GSC_IMPRESSION_BUG_2025_2026', from: '2025-05-13', to: '2026-04-03' }];

export const FACTOR_SUBSCORE_TARGET = 75;
export const MIN_ACTIVE_FACTORS = 3;

const clamp = (v: number, min = 0, max = 100): number => Math.min(max, Math.max(min, v));

/** Factor 1 — Impression Volume. Linear clamp against IMPRESSION_VOLUME_CEILING. */
export function scoreImpressionVolume(input: SeoFactorInputs['impression_volume']): {
  score: number | null;
  status: SeoFactorStatus;
  reason?: string;
} {
  if (!input || input.querySetSize === 0) {
    return { score: null, status: 'insufficientData', reason: 'no_query_set' };
  }
  const raw = (100 * input.impressions) / IMPRESSION_VOLUME_CEILING;
  return { score: clamp(raw), status: 'active' };
}

/** Factor 2 — Click-Through Rate. Linear map 0 → 0, CTR_CEILING → 100. */
export function scoreCtr(input: SeoFactorInputs['click_through_rate']): {
  score: number | null;
  status: SeoFactorStatus;
  reason?: string;
} {
  if (!input || input.impressionWeightedCtr === null || input.totalImpressions <= 0) {
    return { score: null, status: 'insufficientData', reason: 'no_impressions' };
  }
  const raw = (100 * input.impressionWeightedCtr) / CTR_CEILING;
  return { score: clamp(raw), status: 'active' };
}

/** Interpolate the rank-quality curve at a given position. */
export function rankQualityAt(position: number): number {
  const curve = RANK_QUALITY_CURVE;
  if (position <= curve[0].pos) return curve[0].score;
  const last = curve[curve.length - 1];
  if (position >= last.pos) return last.score;
  for (let i = 0; i < curve.length - 1; i += 1) {
    const a = curve[i];
    const b = curve[i + 1];
    if (position >= a.pos && position <= b.pos) {
      const t = (position - a.pos) / (b.pos - a.pos);
      return a.score + t * (b.score - a.score);
    }
  }
  return 0;
}

/** Factor 3 — Rank Quality. Piecewise linear on impression-weighted position. */
export function scoreRankQuality(input: SeoFactorInputs['rank_quality']): {
  score: number | null;
  status: SeoFactorStatus;
  reason?: string;
} {
  if (!input || input.impressionWeightedPosition === null || input.totalImpressions <= 0) {
    return { score: null, status: 'insufficientData', reason: 'no_impressions' };
  }
  const raw = rankQualityAt(input.impressionWeightedPosition);
  return { score: clamp(raw), status: 'active' };
}

/**
 * Factor 4 — AIO Presence. Share of the brand's query-set rows with an AIO
 * citation. Zero matches with a non-empty query set is an active "0" score
 * (meaningful signal), NOT insufficientData.
 */
export function scoreAioPresence(input: SeoFactorInputs['aio_presence']): {
  score: number | null;
  status: SeoFactorStatus;
  reason?: string;
} {
  if (!input || input.querySetSize === 0) {
    return { score: null, status: 'insufficientData', reason: 'no_query_set' };
  }
  const raw = (100 * input.aioMatchedCount) / input.querySetSize;
  return { score: clamp(raw), status: 'active' };
}

/**
 * Compose the final composite from factor results with active-weight
 * redistribution. No display cap in v1 (all factors are either active or
 * insufficientData; no deferred factor).
 */
export function composeScore(factors: SeoFactorResult[]): SeoScoreComposite {
  const active = factors.filter((f) => f.status === 'active' && f.score !== null);

  if (active.length < MIN_ACTIVE_FACTORS) {
    return {
      composite: null,
      compositeRaw: null,
      displayCapApplied: false,
      code: 'INSUFFICIENT_FACTORS',
    };
  }

  let weightedSum = 0;
  let activeWeightTotal = 0;
  for (const f of active) {
    weightedSum += (f.score as number) * f.weight;
    activeWeightTotal += f.weight;
  }

  if (activeWeightTotal === 0) {
    return {
      composite: null,
      compositeRaw: null,
      displayCapApplied: false,
      code: 'INSUFFICIENT_FACTORS',
    };
  }

  const compositeRaw = weightedSum / activeWeightTotal;

  return {
    composite: round1(compositeRaw),
    compositeRaw: round1(compositeRaw),
    displayCapApplied: false,
  };
}

/** Helper: build a SeoFactorResult with its configured weight preserved. */
export function buildFactorResult(
  id: SeoFactorId,
  scored: { score: number | null; status: SeoFactorStatus; reason?: string },
  inputs: Record<string, unknown>
): SeoFactorResult {
  return {
    id,
    score: scored.score === null ? null : round1(scored.score),
    weight: FACTOR_WEIGHTS[id],
    status: scored.status,
    inputs,
    reason: scored.reason,
  };
}

/**
 * Return the advisory ids whose window overlaps [periodStart, periodEnd].
 * Dates are ISO YYYY-MM-DD; overlap uses half-open intersection rules
 * (inclusive on both ends to match GSC daily granularity).
 */
export function detectAdvisories(periodStart: string, periodEnd: string): DataQualityAdvisory[] {
  return GSC_ADVISORY_WINDOWS.filter((w) => periodStart <= w.to && periodEnd >= w.from).map(
    (w) => w.id
  );
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
