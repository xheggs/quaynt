/**
 * Client-side mirror of the SEO Score API response shapes.
 * Kept separate from server types to avoid pulling server deps into client bundles.
 */

export type Granularity = 'weekly' | 'monthly';

export type SeoFactorId =
  | 'impression_volume'
  | 'click_through_rate'
  | 'rank_quality'
  | 'aio_presence';

export type SeoFactorStatus = 'active' | 'insufficientData';

export type SeoRecommendationSeverity = 'low' | 'medium' | 'high';

export type DataQualityAdvisory = 'GSC_IMPRESSION_BUG_2025_2026';

export type SeoScoreCode =
  | 'NO_GSC_CONNECTION'
  | 'NO_ENABLED_PROMPT_SETS'
  | 'NO_BRAND_QUERY_SET'
  | 'INSUFFICIENT_FACTORS';

export interface SeoFactorResult {
  id: SeoFactorId;
  score: number | null;
  weight: number;
  status: SeoFactorStatus;
  inputs: Record<string, unknown>;
  reason?: string;
}

export interface SeoScoreResponse {
  composite: number | null;
  compositeRaw: number | null;
  displayCapApplied: boolean;
  code?: SeoScoreCode | null;
  factors: SeoFactorResult[];
  contributingPromptSetIds: string[];
  querySetSize: number;
  dataQualityAdvisories: DataQualityAdvisory[];
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  formulaVersion: number;
  computedAt: string;
}

export interface SeoScoreRecommendation {
  factorId: SeoFactorId;
  severity: SeoRecommendationSeverity;
  titleKey: string;
  descriptionKey: string;
  estimatedPointDelta: number;
}

export interface SeoScoreRecommendationsResponse {
  recommendations: SeoScoreRecommendation[];
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  formulaVersion: number;
}

export interface SeoScoreSnapshot {
  id: string;
  periodStart: string;
  periodEnd: string;
  granularity: string;
  platformId: string;
  locale: string;
  composite: number | null;
  compositeRaw: number | null;
  displayCapApplied: boolean;
  formulaVersion: number;
  contributingPromptSetIds: string[];
  querySetSize: number;
  dataQualityAdvisories: DataQualityAdvisory[];
  code: SeoScoreCode | null;
  factors: SeoFactorResult[];
  computedAt: string;
}

export interface SeoScoreTrend {
  delta: number | null;
  changeRate: number | null;
  direction: 'up' | 'down' | 'stable' | null;
  ewma: number[];
  overallDirection: 'up' | 'down' | 'stable' | null;
}

export interface SeoScoreHistoryResponse {
  snapshots: SeoScoreSnapshot[];
  trend: SeoScoreTrend;
  formulaVersionChanges: Array<{
    periodStart: string;
    fromVersion: number;
    toVersion: number;
  }>;
}

export interface SeoScoreRecomputeResponse {
  status: string;
  brandId: string;
  periodStart: string;
  granularity: Granularity;
  jobId: string | null;
  deduped: boolean;
}
