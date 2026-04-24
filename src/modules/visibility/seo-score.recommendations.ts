/**
 * Recommendation generation for the SEO Score composite.
 *
 * For each active factor with a sub-score below the benchmark target, emit a
 * recommendation with severity (low/medium/high) and an estimated composite
 * point-delta, sorted descending.
 */

import type {
  SeoFactorId,
  SeoFactorResult,
  SeoRecommendationSeverity,
  SeoScoreRecommendation,
} from './seo-score.types';
import { composeScore, FACTOR_SUBSCORE_TARGET } from './seo-score.formula';

const SEVERITY_RULES: Array<{
  max: number;
  severity: SeoRecommendationSeverity;
}> = [
  { max: 40, severity: 'high' },
  { max: 65, severity: 'medium' },
  { max: FACTOR_SUBSCORE_TARGET, severity: 'low' },
];

function severityFor(score: number): SeoRecommendationSeverity | null {
  for (const rule of SEVERITY_RULES) {
    if (score < rule.max) return rule.severity;
  }
  return null;
}

/** Recommendation copy keys per factor. Kept in sync with app/locales/en/seoScore.json. */
const COPY: Record<SeoFactorId, { titleKey: string; descriptionKey: string }> = {
  impression_volume: {
    titleKey: 'seoScore.recommendations.impression_volume.title',
    descriptionKey: 'seoScore.recommendations.impression_volume.description',
  },
  click_through_rate: {
    titleKey: 'seoScore.recommendations.click_through_rate.title',
    descriptionKey: 'seoScore.recommendations.click_through_rate.description',
  },
  rank_quality: {
    titleKey: 'seoScore.recommendations.rank_quality.title',
    descriptionKey: 'seoScore.recommendations.rank_quality.description',
  },
  aio_presence: {
    titleKey: 'seoScore.recommendations.aio_presence.title',
    descriptionKey: 'seoScore.recommendations.aio_presence.description',
  },
};

/**
 * Estimate the composite point-delta if a single factor reaches
 * FACTOR_SUBSCORE_TARGET, holding other factors constant.
 */
export function estimatePointDelta(factors: SeoFactorResult[], factorId: SeoFactorId): number {
  const current = composeScore(factors);
  if (current.compositeRaw === null) return 0;

  const substituted = factors.map((f) =>
    f.id === factorId
      ? {
          ...f,
          score: FACTOR_SUBSCORE_TARGET,
          status: 'active' as const,
        }
      : f
  );
  const target = composeScore(substituted);
  if (target.compositeRaw === null) return 0;

  const delta = target.compositeRaw - current.compositeRaw;
  return Math.round(delta * 10) / 10;
}

/**
 * Generate recommendations sorted by estimated point-delta (descending).
 * Skips factors that are not active or already at/above target.
 */
export function generateRecommendations(factors: SeoFactorResult[]): SeoScoreRecommendation[] {
  const recs: SeoScoreRecommendation[] = [];

  for (const factor of factors) {
    if (factor.status !== 'active' || factor.score === null) continue;
    const severity = severityFor(factor.score);
    if (severity === null) continue;

    const copy = COPY[factor.id];
    recs.push({
      factorId: factor.id,
      severity,
      titleKey: copy.titleKey,
      descriptionKey: copy.descriptionKey,
      estimatedPointDelta: estimatePointDelta(factors, factor.id),
    });
  }

  return recs.sort((a, b) => b.estimatedPointDelta - a.estimatedPointDelta);
}
