/**
 * Types for the GEO Score composite scoring system.
 *
 * The GEO Score is a brand-level 0-100 composite derived from existing Phase 2
 * aggregates. See docs/architecture/geo-score.md for the published methodology.
 */

export type Granularity = 'weekly' | 'monthly';

export type FactorId =
  | 'citation_frequency'
  | 'source_diversity'
  | 'sentiment_balance'
  | 'position_stability'
  | 'accuracy'
  | 'coverage_breadth';

export type FactorStatus = 'active' | 'notYetScored' | 'insufficientData';

export type RecommendationSeverity = 'low' | 'medium' | 'high';

export const FACTOR_IDS: FactorId[] = [
  'citation_frequency',
  'source_diversity',
  'sentiment_balance',
  'position_stability',
  'accuracy',
  'coverage_breadth',
];

/** Raw inputs for one factor. `null` means the input is not available. */
export interface FactorInputs {
  citation_frequency: {
    sharePercentage: number | null;
    totalCitations: number;
  } | null;
  source_diversity: {
    domainCount: number;
  } | null;
  sentiment_balance: {
    netSentimentScore: number | null;
    totalCitations: number;
  } | null;
  position_stability: {
    firstMentionRate: number | null;
    cv: number | null;
    window: { granularity: Granularity; periodsUsed: number };
  } | null;
  accuracy: {
    hallucinationRate: number | null;
  } | null;
  coverage_breadth: {
    observedPairs: number;
    expectedPairs: number | null;
    expectedSource: 'promptSetConfig' | null;
  } | null;
}

/** Collected inputs + metadata for scoring a single brand over one period. */
export interface GeoScoreInputs {
  workspaceId: string;
  brandId: string;
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  contributingPromptSetIds: string[];
  factors: FactorInputs;
}

export interface FactorResult {
  id: FactorId;
  /** 0-100 when status === 'active'; null otherwise. */
  score: number | null;
  /** The weight originally assigned to this factor in the formula (not the redistributed weight). */
  weight: number;
  status: FactorStatus;
  /** Raw inputs used for transparency / audit. */
  inputs: Record<string, unknown>;
  /** Optional human-readable code for why a factor is not active. */
  reason?: string;
}

export interface GeoScoreComposite {
  /** Display value — raw composite passed through display cap (e.g. PRE_ACCURACY_CAP). */
  composite: number | null;
  /** Raw composite before the display cap is applied. `null` when <3 active factors. */
  compositeRaw: number | null;
  displayCapApplied: boolean;
  /** Set when composite is null. */
  code?: 'INSUFFICIENT_FACTORS' | 'NO_ENABLED_PROMPT_SETS';
}

export interface GeoScoreResult extends GeoScoreComposite {
  workspaceId: string;
  brandId: string;
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  platformId: string;
  locale: string;
  formulaVersion: number;
  computedAt: Date;
  contributingPromptSetIds: string[];
  factors: FactorResult[];
  recommendations: GeoScoreRecommendation[];
}

export interface GeoScoreRecommendation {
  factorId: FactorId;
  severity: RecommendationSeverity;
  titleKey: string;
  descriptionKey: string;
  /** Estimated composite lift if this factor alone reaches FACTOR_SUBSCORE_TARGET. */
  estimatedPointDelta: number;
}
