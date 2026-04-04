export type ComparisonPeriod = 'previous_period' | 'previous_week' | 'previous_month';

export interface BenchmarkFilters {
  promptSetId: string;
  platformId?: string;
  locale?: string;
  from?: string;
  to?: string;
  brandIds?: string[];
  comparisonPeriod?: ComparisonPeriod;
}

export interface PlatformBenchmark {
  platformId: string;
  sharePercentage: string;
  delta: string | null;
  citationCount: number;
}

export interface BrandBenchmark {
  brandId: string;
  brandName: string;
  rank: number;
  rankChange: number | null;
  recommendationShare: {
    current: string;
    previous: string | null;
    delta: string | null;
    direction: 'up' | 'down' | 'stable' | null;
  };
  citationCount: {
    current: number;
    previous: number | null;
    delta: number | null;
  };
  modelRunCount: number;
  platformBreakdown?: PlatformBenchmark[];
}

export interface BenchmarkResult {
  market: {
    promptSetId: string;
    name: string;
  };
  period: {
    from: string;
    to: string;
    comparisonFrom: string | null;
    comparisonTo: string | null;
  };
  brands: BrandBenchmark[];
  meta: {
    totalBrands: number;
    totalPrompts: number;
    lastUpdatedAt: string | null;
  };
}

export interface PresenceMatrixFilters {
  promptSetId: string;
  brandIds?: string[];
  platformId?: string;
  from?: string;
  to?: string;
}

export interface PresenceMatrixRow {
  promptId: string;
  promptText: string;
  brands: {
    brandId: string;
    brandName: string;
    present: boolean;
    citationCount: number;
  }[];
}
