/**
 * Dual Score constants and pure helpers.
 *
 * Named constants so they can be cross-referenced from tests and the
 * methodology doc. All thresholds documented in
 * docs/architecture/dual-score.md.
 */

import type {
  CorrelationDirection,
  CorrelationLabel,
  DualQueryRow,
  GapSignal,
  Granularity,
} from './dual-score.types';

/** Trailing window sizes used when computing Spearman correlation. */
export const DUAL_CORRELATION_WINDOW: Record<Granularity, number> = {
  weekly: 12,
  monthly: 6,
};

/** Minimum aligned pairs before any coefficient is computed. */
export const DUAL_CORRELATION_MIN_SAMPLES = 6;

/** Minimum aligned pairs before a qualitative label is attached. */
export const DUAL_CORRELATION_LABEL_MIN_SAMPLES = 10;

/**
 * Qualitative labels applied only at n >= DUAL_CORRELATION_LABEL_MIN_SAMPLES.
 * Ordered descending: the first entry whose `min` is <= |rho| wins.
 */
export const CORRELATION_LABEL_THRESHOLDS: Array<{
  min: number;
  label: Extract<CorrelationLabel, 'strong' | 'moderate' | 'weak' | 'none'>;
}> = [
  { min: 0.7, label: 'strong' },
  { min: 0.4, label: 'moderate' },
  { min: 0.2, label: 'weak' },
  { min: 0, label: 'none' },
];

/**
 * Gap-signal floors. Deliberately asymmetric: SEO signals are noisier at low
 * volume, AI signals cluster harder. Revisitable after 90 days of production
 * data.
 */
export const GAP_SEO_IMPRESSIONS_FLOOR = 100;
export const GAP_AI_CITATION_FLOOR = 3;
export const GAP_SEO_NOISE_FLOOR = 20;

/**
 * Sufficiency-aware correlation label.
 *
 * - n < DUAL_CORRELATION_MIN_SAMPLES          → 'insufficientData'
 * - n < DUAL_CORRELATION_LABEL_MIN_SAMPLES    → 'earlyReading'
 * - n >= LABEL threshold → first threshold whose min <= |rho|
 *
 * `rho` may be null (e.g. constant column) — in that case we still return
 * 'insufficientData' if n is below the floor, otherwise 'earlyReading'. If
 * both conditions are satisfied (n high enough, but rho undefined), we fall
 * through to 'earlyReading' as a conservative default.
 */
export function labelCorrelation(rho: number | null, n: number): CorrelationLabel {
  if (n < DUAL_CORRELATION_MIN_SAMPLES) return 'insufficientData';
  if (rho === null) return 'earlyReading';
  if (n < DUAL_CORRELATION_LABEL_MIN_SAMPLES) return 'earlyReading';
  const absRho = Math.abs(rho);
  for (const t of CORRELATION_LABEL_THRESHOLDS) {
    if (absRho >= t.min) return t.label;
  }
  return 'none';
}

/** Direction derived from the rho sign. `flat` when exactly zero. */
export function correlationDirection(rho: number | null): CorrelationDirection | null {
  if (rho === null) return null;
  if (rho > 0) return 'positive';
  if (rho < 0) return 'negative';
  return 'flat';
}

/**
 * Per-query gap classification. Impression / AIO-count floors are named
 * constants so support can reason about edge cases without re-reading code.
 */
export function classifyGapSignal(row: {
  impressions: number;
  aioCitationCount: number;
}): GapSignal {
  const { impressions, aioCitationCount } = row;
  const seoStrong = impressions >= GAP_SEO_IMPRESSIONS_FLOOR;
  const aiStrong = aioCitationCount >= GAP_AI_CITATION_FLOOR;
  const seoNoisy = impressions < GAP_SEO_NOISE_FLOOR;

  if (seoStrong && aiStrong) return 'balanced';
  if (seoStrong && aioCitationCount === 0) return 'high_seo_no_ai';
  if (aiStrong && seoNoisy) return 'high_ai_no_seo';
  return 'no_signal';
}

/** Convenience wrapper used by the service when shaping a DualQueryRow. */
export function classifyGapSignalForRow(row: DualQueryRow): GapSignal {
  return classifyGapSignal({
    impressions: row.impressions,
    aioCitationCount: row.aioCitationCount,
  });
}
