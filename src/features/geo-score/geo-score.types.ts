/**
 * Client-side mirror of the GEO Score API response shapes.
 * Kept separate from server types to avoid pulling server deps into client bundles.
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

export interface FactorResult {
  id: FactorId;
  score: number | null;
  weight: number;
  status: FactorStatus;
  inputs: Record<string, unknown>;
  reason?: string;
}

export interface GeoScoreResponse {
  composite: number | null;
  compositeRaw: number | null;
  displayCapApplied: boolean;
  code?: 'INSUFFICIENT_FACTORS' | 'NO_ENABLED_PROMPT_SETS';
  factors: FactorResult[];
  contributingPromptSetIds: string[];
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  formulaVersion: number;
  computedAt: string;
}

export interface GeoScoreRecommendation {
  factorId: FactorId;
  severity: RecommendationSeverity;
  titleKey: string;
  descriptionKey: string;
  estimatedPointDelta: number;
}

export interface GeoScoreRecommendationsResponse {
  recommendations: GeoScoreRecommendation[];
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
  formulaVersion: number;
}

export interface GeoScoreSnapshot {
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
  factors: FactorResult[];
  computedAt: string;
}

export interface GeoScoreTrend {
  delta: number | null;
  changeRate: number | null;
  direction: 'up' | 'down' | 'stable' | null;
  ewma: number[];
  overallDirection: 'up' | 'down' | 'stable' | null;
}

export interface GeoScoreHistoryResponse {
  snapshots: GeoScoreSnapshot[];
  trend: GeoScoreTrend;
  formulaVersionChanges: Array<{ periodStart: string; fromVersion: number; toVersion: number }>;
}
