/**
 * Pure scoring functions and calibration constants for the GEO Score composite.
 *
 * Single source of truth for weights, ceilings, and score composition rules.
 * Bumping `FORMULA_VERSION` triggers a migration-backed backfill (see geo-score.handler).
 */

import type {
  FactorId,
  FactorInputs,
  FactorResult,
  FactorStatus,
  GeoScoreComposite,
  Granularity,
} from './geo-score.types';

export const FORMULA_VERSION = 1;

export const FACTOR_WEIGHTS: Record<FactorId, number> = {
  citation_frequency: 25,
  source_diversity: 15,
  sentiment_balance: 15,
  position_stability: 15,
  accuracy: 20,
  coverage_breadth: 10,
};

// Calibration constants (see docs/architecture/geo-score.md).
export const CITATION_FREQUENCY_CEILING = 50;
export const SOURCE_DIVERSITY_CEILING = 30;
export const POSITION_STABILITY_WINDOW: Record<Granularity, number> = {
  weekly: 6,
  monthly: 3,
};
export const POSITION_STABILITY_MIN_POINTS = 3;
export const PRE_ACCURACY_CAP = 95;
export const FACTOR_SUBSCORE_TARGET = 75;
export const MIN_ACTIVE_FACTORS = 3;

const clamp = (v: number, min = 0, max = 100): number => Math.min(max, Math.max(min, v));

/** Factor 1 — Citation Frequency. Linear map from 0% → 0 to CEILING% → 100. */
export function scoreCitationFrequency(input: FactorInputs['citation_frequency']): {
  score: number | null;
  status: FactorStatus;
  reason?: string;
} {
  if (!input || input.sharePercentage === null) {
    return { score: null, status: 'insufficientData', reason: 'no_share_percentage' };
  }
  const raw = (input.sharePercentage / CITATION_FREQUENCY_CEILING) * 100;
  return { score: clamp(raw), status: 'active' };
}

/** Factor 2 — Source Diversity. Log-scaled domain count. */
export function scoreSourceDiversity(input: FactorInputs['source_diversity']): {
  score: number | null;
  status: FactorStatus;
  reason?: string;
} {
  if (!input) {
    return { score: null, status: 'insufficientData', reason: 'no_domains' };
  }
  const { domainCount } = input;
  if (domainCount <= 0) return { score: 0, status: 'active' };
  const raw = (100 * Math.log10(domainCount + 1)) / Math.log10(SOURCE_DIVERSITY_CEILING + 1);
  return { score: clamp(raw), status: 'active' };
}

/** Factor 3 — Sentiment Balance. Linear map from -1 → 0 to +1 → 100. */
export function scoreSentimentBalance(input: FactorInputs['sentiment_balance']): {
  score: number | null;
  status: FactorStatus;
  reason?: string;
} {
  if (!input || input.netSentimentScore === null) {
    return { score: null, status: 'insufficientData', reason: 'no_sentiment' };
  }
  const raw = (input.netSentimentScore + 1) * 50;
  return { score: clamp(raw), status: 'active' };
}

/** Factor 4 — Position Stability. 0.6 * first-mention + 0.4 * (100 - 100 * CV). */
export function scorePositionStability(input: FactorInputs['position_stability']): {
  score: number | null;
  status: FactorStatus;
  reason?: string;
} {
  if (!input || input.firstMentionRate === null || input.cv === null) {
    return { score: null, status: 'insufficientData', reason: 'insufficient_points' };
  }
  const firstMention = clamp(input.firstMentionRate * 100);
  const stabilityScore = clamp(100 - 100 * input.cv);
  const raw = 0.6 * firstMention + 0.4 * stabilityScore;
  return { score: clamp(raw), status: 'active' };
}

/** Factor 5 — Accuracy. notYetScored when hallucination rate is unavailable. */
export function scoreAccuracy(input: FactorInputs['accuracy']): {
  score: number | null;
  status: FactorStatus;
  reason?: string;
} {
  if (!input || input.hallucinationRate === null) {
    return { score: null, status: 'notYetScored', reason: 'accuracy_module_not_live' };
  }
  const raw = 100 * (1 - input.hallucinationRate);
  return { score: clamp(raw), status: 'active' };
}

/** Factor 6 — Coverage Breadth. Observed / expected pairs, linear. */
export function scoreCoverageBreadth(input: FactorInputs['coverage_breadth']): {
  score: number | null;
  status: FactorStatus;
  reason?: string;
} {
  if (!input || input.expectedPairs === null || input.expectedPairs <= 0) {
    return { score: null, status: 'insufficientData', reason: 'no_expected_pairs' };
  }
  const raw = (100 * input.observedPairs) / input.expectedPairs;
  return { score: clamp(raw), status: 'active' };
}

/**
 * Apply the display cap when Accuracy is `notYetScored`.
 * Exposed for testing; also called from composeScore.
 */
export function applyDisplayCap(raw: number, factors: FactorResult[]): number {
  const accuracy = factors.find((f) => f.id === 'accuracy');
  if (accuracy?.status === 'notYetScored') {
    return Math.min(raw, PRE_ACCURACY_CAP);
  }
  return raw;
}

/**
 * Compose the final composite from factor results with active-weight redistribution.
 * Returns {composite, compositeRaw, displayCapApplied}.
 * When <MIN_ACTIVE_FACTORS are active, composite is null.
 */
export function composeScore(factors: FactorResult[]): GeoScoreComposite {
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
  const composite = applyDisplayCap(compositeRaw, factors);
  const displayCapApplied = composite < compositeRaw;

  return {
    composite: round1(composite),
    compositeRaw: round1(compositeRaw),
    displayCapApplied,
  };
}

/** Helper: build a FactorResult with its configured weight preserved. */
export function buildFactorResult(
  id: FactorId,
  scored: { score: number | null; status: FactorStatus; reason?: string },
  inputs: Record<string, unknown>
): FactorResult {
  return {
    id,
    score: scored.score === null ? null : round1(scored.score),
    weight: FACTOR_WEIGHTS[id],
    status: scored.status,
    inputs,
    reason: scored.reason,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
