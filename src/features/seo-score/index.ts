export type {
  Granularity,
  SeoFactorId,
  SeoFactorStatus,
  SeoFactorResult,
  SeoScoreResponse,
  SeoScoreRecommendation,
  SeoScoreRecommendationsResponse,
  SeoScoreSnapshot,
  SeoScoreTrend,
  SeoScoreHistoryResponse,
  SeoRecommendationSeverity,
  DataQualityAdvisory,
  SeoScoreCode,
} from './seo-score.types';

export {
  fetchSeoScore,
  fetchSeoScoreHistory,
  fetchSeoScoreRecommendations,
  recomputeSeoScore,
} from './seo-score.api';

export {
  useSeoScoreQuery,
  useSeoScoreHistoryQuery,
  useSeoScoreRecommendationsQuery,
  useRecomputeSeoScoreMutation,
} from './use-seo-score';

export { SeoScoreView } from './components/seo-score-view';
