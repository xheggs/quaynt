import type { ComparisonPeriod } from '@/modules/visibility/comparison.utils';

export type ReportMetric =
  | 'recommendation_share'
  | 'citation_count'
  | 'sentiment'
  | 'positions'
  | 'sources'
  | 'opportunities';

export const VALID_REPORT_METRICS: ReportMetric[] = [
  'recommendation_share',
  'citation_count',
  'sentiment',
  'positions',
  'sources',
  'opportunities',
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

export interface BrandReportData {
  brand: { brandId: string; brandName: string };
  metrics: {
    recommendationShare?: MetricBlock;
    citationCount?: MetricBlock;
    sentiment?: MetricBlock;
    positions?: MetricBlock;
    sources?: SourceMetricBlock;
    opportunities?: OpportunityMetricBlock;
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
