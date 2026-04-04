export { recommendationShare } from './recommendation-share.schema';
export { sentimentAggregate } from './sentiment-aggregate.schema';
export { citationSourceAggregate } from './citation-source-aggregate.schema';
export { getBenchmarks, getPresenceMatrix, BENCHMARK_ALLOWED_SORTS } from './benchmark.service';
export {
  getSentimentAggregates,
  getLatestSentiment,
  SENTIMENT_AGGREGATE_ALLOWED_SORTS,
} from './sentiment-aggregate.service';
export {
  getCitationSources,
  CITATION_SOURCE_ALLOWED_SORTS,
} from './citation-source-aggregate.service';
export type {
  BenchmarkFilters,
  BrandBenchmark,
  PlatformBenchmark,
  BenchmarkResult,
  PresenceMatrixFilters,
  PresenceMatrixRow,
} from './benchmark.types';
export type {
  SentimentAggregateFilters,
  SentimentAggregateComputeInput,
  SentimentAggregateRow,
} from './sentiment-aggregate.types';
export type {
  CitationSourceFilters,
  CitationSourceComputeInput,
  CitationSourceAggregateRow,
} from './citation-source-aggregate.types';
export { opportunity } from './opportunity.schema';
export { getOpportunities, OPPORTUNITY_ALLOWED_SORTS } from './opportunity.service';
export type {
  OpportunityType,
  OpportunityFilters,
  OpportunityComputeInput,
  OpportunityRow,
  OpportunitySummary,
  OpportunityCompetitor,
  OpportunityPlatformBreakdown,
} from './opportunity.types';
export { positionAggregate } from './position-aggregate.schema';
export {
  getPositionAggregates,
  POSITION_AGGREGATE_ALLOWED_SORTS,
} from './position-aggregate.service';
export type {
  PositionAggregateComputeInput,
  PositionAggregateFilters,
  PositionAggregateRow,
  PositionSummary,
} from './position-aggregate.types';
export { getTrends } from './trend.service';
export { trendSnapshot } from './trend-snapshot.schema';
export type {
  TrendMetric,
  TrendPeriod,
  TrendFilters,
  TrendDataPoint,
  TrendDataPointCommercial,
  TrendSummary,
  TrendResult,
} from './trend.types';
