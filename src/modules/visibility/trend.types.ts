export type TrendMetric =
  | 'recommendation_share'
  | 'sentiment'
  | 'average_position'
  | 'first_mention_rate'
  | 'citation_count'
  | 'opportunity_count';

export type TrendPeriod = 'weekly' | 'monthly';

export interface TrendFilters {
  metric: TrendMetric;
  promptSetId: string;
  brandId: string;
  platformId?: string;
  locale?: string;
  period?: TrendPeriod;
  from?: string;
  to?: string;
  includeMovingAverage?: boolean;
}

export interface TrendDataPoint {
  periodStart: string;
  periodEnd: string;
  value: string;
  previousValue: string | null;
  delta: string | null;
  changeRate: string | null;
  direction: 'up' | 'down' | 'stable' | null;
  movingAverage: string | null;
  dataPoints: number;
}

export interface TrendDataPointCommercial extends TrendDataPoint {
  isSignificant: boolean | null;
  pValue: number | null;
  confidenceInterval: { lower: string; upper: string } | null;
  isAnomaly: boolean | null;
  anomalyDirection: 'above' | 'below' | null;
  ewmaUpper: string | null;
  ewmaLower: string | null;
}

export interface TrendSummary {
  latestValue: string;
  latestDelta: string | null;
  latestDirection: 'up' | 'down' | 'stable' | null;
  overallDirection: 'up' | 'down' | 'stable' | null;
  overallChangeRate: string | null;
  periodCount: number;
  dataPointCount: number;
}

export interface TrendResult {
  metric: TrendMetric;
  brand: { brandId: string; brandName: string };
  market: { promptSetId: string; name: string };
  period: TrendPeriod;
  filters: { platformId: string; locale: string; from: string; to: string };
  dataPoints: TrendDataPoint[];
  summary: TrendSummary;
}
