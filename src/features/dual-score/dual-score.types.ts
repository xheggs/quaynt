/**
 * Client-side mirror of the Dual Score API response shapes. Kept separate
 * from server types to avoid pulling server deps into client bundles.
 */

import type { FactorResult } from '@/features/geo-score/geo-score.types';
import type { DataQualityAdvisory, SeoFactorResult } from '@/features/seo-score/seo-score.types';

export type Granularity = 'weekly' | 'monthly';

export type GapSignal = 'high_seo_no_ai' | 'high_ai_no_seo' | 'balanced' | 'no_signal';

export type DualScoreCode =
  | 'NO_SEO_SNAPSHOTS'
  | 'NO_GEO_SNAPSHOTS'
  | 'NO_SNAPSHOTS'
  | 'INSUFFICIENT_WINDOW';

export type CorrelationLabel =
  | 'insufficientData'
  | 'earlyReading'
  | 'strong'
  | 'moderate'
  | 'weak'
  | 'none';

export type CorrelationDirection = 'positive' | 'negative' | 'flat';

export interface DualCorrelationStat {
  rho: number | null;
  label: CorrelationLabel;
  direction: CorrelationDirection | null;
  n: number;
  code: 'insufficientData' | null;
  window: { from: string; to: string };
}

export interface DualScoreSidePayload<Factor> {
  composite: number | null;
  compositeRaw: number | null;
  displayCapApplied: boolean;
  delta: number | null;
  formulaVersion: number;
  factors: Factor[];
  contributingPromptSetIds: string[];
  periodStart: string;
  periodEnd: string;
  code?: string | null;
}

export interface DualScoreResponse {
  workspaceId: string;
  brandId: string;
  at: string;
  granularity: Granularity;
  seo: DualScoreSidePayload<SeoFactorResult> | null;
  geo: DualScoreSidePayload<FactorResult> | null;
  correlation: DualCorrelationStat;
  dataQualityAdvisories: DataQualityAdvisory[];
  codes: DualScoreCode[];
}

export interface DualHistoryPair {
  periodStart: string;
  periodEnd: string;
  seo: number | null;
  geo: number | null;
  seoDelta: number | null;
  geoDelta: number | null;
}

export interface DualHistoryResponse {
  pairs: DualHistoryPair[];
  granularity: Granularity;
  formulaVersionChanges: Array<{
    source: 'seo' | 'geo';
    periodStart: string;
    fromVersion: number;
    toVersion: number;
  }>;
}

export interface DualQueryRow {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number | null;
  aioCitationCount: number;
  aioFirstSeenAt: string | null;
  brandMentionRate: number | null;
  avgBrandPosition: number | null;
  netSentimentScore: number | null;
  gapSignal: GapSignal;
}

export interface DualQueriesResponse {
  rows: DualQueryRow[];
  page: number;
  limit: number;
  totalRows: number;
  totalPages: number;
}

export type DualCombinedRecommendationSource = 'seo' | 'geo';

export interface DualCombinedRecommendation {
  source: DualCombinedRecommendationSource;
  factorId: string;
  severity: 'low' | 'medium' | 'high';
  titleKey: string;
  descriptionKey: string;
  estimatedPointDelta: number;
}

export interface DualCombinedRecommendationsResponse {
  recommendations: DualCombinedRecommendation[];
  partial: boolean;
  failedSource: DualCombinedRecommendationSource | null;
  periodStart: string;
  periodEnd: string;
  granularity: Granularity;
}
