/**
 * Types for the SEO Score composite scoring system.
 *
 * The SEO Score is a brand-level 0-100 composite derived from Google Search
 * Console data (gsc_query_performance) restricted to the brand's prompt-derived
 * query set, plus AIO citation coverage. See docs/architecture/seo-score.md for
 * the published methodology.
 *
 * Duplicates the shape (FactorStatus, severity, granularity) of the GEO Score
 * types on purpose — the shared-primitive extraction happens in 6.5b once two
 * concrete consumers exist to define the right interface.
 */

export type Granularity = 'weekly' | 'monthly';

export type SeoFactorId =
  | 'impression_volume'
  | 'click_through_rate'
  | 'rank_quality'
  | 'aio_presence';

export type SeoFactorStatus = 'active' | 'insufficientData';

export type SeoRecommendationSeverity = 'low' | 'medium' | 'high';

export const SEO_FACTOR_IDS: SeoFactorId[] = [
  'impression_volume',
  'click_through_rate',
  'rank_quality',
  'aio_presence',
];

export type DataQualityAdvisory = 'GSC_IMPRESSION_BUG_2025_2026';

export type SeoScoreCode =
  | 'NO_GSC_CONNECTION'
  | 'NO_ENABLED_PROMPT_SETS'
  | 'NO_BRAND_QUERY_SET'
  | 'INSUFFICIENT_FACTORS';

/** Raw inputs for one factor. `null` means the input is not available. */
export interface SeoFactorInputs {
  impression_volume: {
    impressions: number;
    querySetSize: number;
  } | null;
  click_through_rate: {
    impressionWeightedCtr: number | null;
    totalImpressions: number;
  } | null;
  rank_quality: {
    impressionWeightedPosition: number | null;
    totalImpressions: number;
  } | null;
  aio_presence: {
    aioMatchedCount: number;
    querySetSize: number;
  } | null;
}

/** Collected inputs + metadata for scoring a single brand over one period. */
export interface SeoScoreInputs {
  workspaceId: string;
  brandId: string;
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  contributingPromptSetIds: string[];
  querySetSize: number;
  factors: SeoFactorInputs;
  /** Early-exit code when the score cannot be computed. */
  code?: SeoScoreCode;
}

export interface SeoFactorResult {
  id: SeoFactorId;
  /** 0-100 when status === 'active'; null otherwise. */
  score: number | null;
  /** The weight originally assigned to this factor in the formula (not the redistributed weight). */
  weight: number;
  status: SeoFactorStatus;
  /** Raw inputs used for transparency / audit. */
  inputs: Record<string, unknown>;
  /** Optional human-readable code for why a factor is not active. */
  reason?: string;
}

export interface SeoScoreComposite {
  composite: number | null;
  compositeRaw: number | null;
  displayCapApplied: boolean;
  code?: SeoScoreCode;
}

export interface SeoScoreResult extends SeoScoreComposite {
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
  querySetSize: number;
  dataQualityAdvisories: DataQualityAdvisory[];
  factors: SeoFactorResult[];
  recommendations: SeoScoreRecommendation[];
}

export interface SeoScoreRecommendation {
  factorId: SeoFactorId;
  severity: SeoRecommendationSeverity;
  titleKey: string;
  descriptionKey: string;
  /** Estimated composite lift if this factor alone reaches FACTOR_SUBSCORE_TARGET. */
  estimatedPointDelta: number;
}
