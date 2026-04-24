import type { ComparisonPeriod } from '@/modules/visibility/comparison.utils';

export type ReportMetric =
  | 'recommendation_share'
  | 'citation_count'
  | 'sentiment'
  | 'positions'
  | 'sources'
  | 'opportunities'
  | 'geo_score'
  | 'seo_score';

export const VALID_REPORT_METRICS: ReportMetric[] = [
  'recommendation_share',
  'citation_count',
  'sentiment',
  'positions',
  'sources',
  'opportunities',
  'geo_score',
  'seo_score',
];

export interface ReportDataFilters {
  promptSetId: string;
  brandId?: string;
  brandIds?: string[];
  from?: string;
  to?: string;
  comparisonPeriod?: ComparisonPeriod;
  metrics?: ReportMetric[];
  platformId?: string;
  locale?: string;
}

export interface SparklinePoint {
  date: string;
  value: string;
}

export interface MetricBlock {
  current: string;
  previous: string | null;
  delta: string | null;
  changeRate: string | null;
  direction: 'up' | 'down' | 'stable' | null;
  sparkline: SparklinePoint[];
}

export interface SourceMetricBlock extends MetricBlock {
  topDomains: { domain: string; frequency: number }[];
}

export interface OpportunityMetricBlock extends MetricBlock {
  byType: { missing: number; weak: number };
}

export interface GeoScoreFactorBlock {
  id: string;
  score: number | null;
  weight: number;
  status: string;
}

export interface GeoScoreMetricBlock {
  composite: number | null;
  compositeRaw: number | null;
  displayCapApplied: boolean;
  formulaVersion: number;
  factors: GeoScoreFactorBlock[];
  periodStart: string;
  periodEnd: string;
  trend: { delta: number | null; direction: 'up' | 'down' | 'stable' | null };
  sparkline: SparklinePoint[];
}

export interface SeoScoreFactorBlock {
  id: string;
  score: number | null;
  weight: number;
  status: string;
}

export interface SeoScoreMetricBlock {
  composite: number | null;
  compositeRaw: number | null;
  displayCapApplied: boolean;
  formulaVersion: number;
  factors: SeoScoreFactorBlock[];
  periodStart: string;
  periodEnd: string;
  querySetSize: number;
  dataQualityAdvisories: string[];
  code: string | null;
  trend: { delta: number | null; direction: 'up' | 'down' | 'stable' | null };
  sparkline: SparklinePoint[];
}

export interface DualScoreCorrelationBlock {
  rho: number | null;
  label: 'insufficientData' | 'earlyReading' | 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'positive' | 'negative' | 'flat' | null;
  n: number;
  window: { from: string; to: string };
}

export interface DualScoreGapQueryBlock {
  query: string;
  impressions: number;
  aioCitationCount: number;
  gapSignal: 'high_seo_no_ai' | 'high_ai_no_seo' | 'balanced' | 'no_signal';
}

export interface DualScoreMetricBlock {
  seoComposite: number | null;
  geoComposite: number | null;
  seoDelta: number | null;
  geoDelta: number | null;
  correlation: DualScoreCorrelationBlock;
  topGapQueries: DualScoreGapQueryBlock[];
  dataQualityAdvisories: string[];
  codes: string[];
}

export interface BrandReportData {
  brand: { brandId: string; brandName: string };
  metrics: {
    recommendationShare?: MetricBlock;
    citationCount?: MetricBlock;
    sentiment?: MetricBlock;
    positions?: MetricBlock;
    sources?: SourceMetricBlock;
    opportunities?: OpportunityMetricBlock;
    geoScore?: GeoScoreMetricBlock;
    seoScore?: SeoScoreMetricBlock;
    dualScore?: DualScoreMetricBlock;
  };
}

export interface ReportDataResponse {
  market: { promptSetId: string; name: string };
  period: {
    from: string;
    to: string;
    comparisonFrom: string | null;
    comparisonTo: string | null;
  };
  filters: { platformId: string; locale: string };
  brands: BrandReportData[];
  warnings?: string[];
}
