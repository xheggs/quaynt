/**
 * Recommendation generation for the GEO Score composite.
 *
 * For each factor with a sub-score below the benchmark target, emit 0-2 recommendations
 * with a severity and an estimated composite point-delta.
 */

import type {
  FactorId,
  FactorResult,
  GeoScoreRecommendation,
  RecommendationSeverity,
} from './geo-score.types';
import { composeScore, FACTOR_SUBSCORE_TARGET } from './geo-score.formula';

const SEVERITY_RULES: Array<{
  max: number;
  severity: RecommendationSeverity;
}> = [
  { max: 40, severity: 'high' },
  { max: 65, severity: 'medium' },
  { max: FACTOR_SUBSCORE_TARGET, severity: 'low' },
];

function severityFor(score: number): RecommendationSeverity | null {
  for (const rule of SEVERITY_RULES) {
    if (score < rule.max) return rule.severity;
  }
  return null;
}

/** Recommendation copy keys per factor. Kept in sync with app/locales/en/geoScore.json. */
const COPY: Record<Exclude<FactorId, 'accuracy'>, { titleKey: string; descriptionKey: string }> = {
  citation_frequency: {
    titleKey: 'geoScore.recommendations.citation_frequency.title',
    descriptionKey: 'geoScore.recommendations.citation_frequency.description',
  },
  source_diversity: {
    titleKey: 'geoScore.recommendations.source_diversity.title',
    descriptionKey: 'geoScore.recommendations.source_diversity.description',
  },
  sentiment_balance: {
    titleKey: 'geoScore.recommendations.sentiment_balance.title',
    descriptionKey: 'geoScore.recommendations.sentiment_balance.description',
  },
  position_stability: {
    titleKey: 'geoScore.recommendations.position_stability.title',
    descriptionKey: 'geoScore.recommendations.position_stability.description',
  },
  coverage_breadth: {
    titleKey: 'geoScore.recommendations.coverage_breadth.title',
    descriptionKey: 'geoScore.recommendations.coverage_breadth.description',
  },
};

/**
 * Estimate the composite point-delta if a single factor reaches FACTOR_SUBSCORE_TARGET.
 * Documented as "lift if this factor alone reaches the target, holding other factors constant."
 */
export function estimatePointDelta(factors: FactorResult[], factorId: FactorId): number {
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
 * Skips factors that are `notYetScored` or `insufficientData`, and factors already at/above target.
 */
export function generateRecommendations(factors: FactorResult[]): GeoScoreRecommendation[] {
  const recs: GeoScoreRecommendation[] = [];

  for (const factor of factors) {
    if (factor.status !== 'active' || factor.score === null) continue;
    if (factor.id === 'accuracy') continue; // accuracy has no actionable recommendation surface yet
    const severity = severityFor(factor.score);
    if (severity === null) continue;

    const copy = COPY[factor.id as Exclude<FactorId, 'accuracy'>];
    if (!copy) continue;

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
