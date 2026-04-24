/**
 * Types for the Dual Score analytics layer.
 *
 * 6.5b derives a unified SEO + GEO view from the existing geo_score_snapshot
 * and seo_score_snapshot tables. There is no dual_score_snapshot table — the
 * dual view is read-only, computed at query time, and composed from upstream
 * results. See docs/architecture/dual-score.md for the methodology.
 */

import type { FactorResult, GeoScoreRecommendation, Granularity } from './geo-score.types';
import type {
  DataQualityAdvisory,
  SeoFactorResult,
  SeoScoreRecommendation,
} from './seo-score.types';

export type { Granularity };

export type GapSignal = 'high_seo_no_ai' | 'high_ai_no_seo' | 'balanced' | 'no_signal';

/**
 * Response-level codes on `/dual-score`. Emitted as `codes: string[]` because
 * more than one orthogonal condition can apply (e.g. `NO_GEO_SNAPSHOTS` +
 * `INSUFFICIENT_WINDOW`).
 */
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
  /** Numeric Spearman rho, or null when below the minimum-samples floor. */
  rho: number | null;
  /** Qualitative label. Only `strong|moderate|weak|none` at n >= 10. */
  label: CorrelationLabel;
  /** Sign-derived direction; null when label is `insufficientData`. */
  direction: CorrelationDirection | null;
  /** Count of aligned snapshot pairs used for the coefficient. */
  n: number;
  /**
   * Machine code distinguishing correlation states.
   * `'insufficientData'` when n < DUAL_CORRELATION_MIN_SAMPLES, otherwise null.
   */
  code: 'insufficientData' | null;
  window: {
    from: string;
    to: string;
  };
}

export interface DualScoreSidePayload<Factor> {
  composite: number | null;
  compositeRaw: number | null;
  /** Only meaningful on the GEO side; always false on SEO in v1. */
  displayCapApplied: boolean;
  delta: number | null;
  formulaVersion: number;
  factors: Factor[];
  contributingPromptSetIds: string[];
  periodStart: string;
  periodEnd: string;
  /** Upstream-specific code, forwarded verbatim for debugging. */
  code?: string | null;
}

export interface DualScoreResult {
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

export interface DualHistoryResult {
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
  /** Impression-weighted average GSC position. */
  avgPosition: number | null;
  aioCitationCount: number;
  aioFirstSeenAt: string | null;
  /** Share of AIO citations in which the brand is mentioned (0–1). */
  brandMentionRate: number | null;
  /** Mean position within AIO citations when the brand is mentioned. */
  avgBrandPosition: number | null;
  netSentimentScore: number | null;
  gapSignal: GapSignal;
}

export interface DualQueriesPage {
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

export interface DualCombinedRecommendationsResult {
  recommendations: DualCombinedRecommendation[];
  partial: boolean;
  failedSource: DualCombinedRecommendationSource | null;
}

export type { GeoScoreRecommendation, SeoScoreRecommendation };
