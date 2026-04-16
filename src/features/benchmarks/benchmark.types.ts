/**
 * Client-side benchmark types.
 *
 * These mirror the server-side types from @/modules/visibility/benchmark.types
 * but are duplicated here to avoid importing from server modules, which can
 * pull in server-side dependencies through barrel re-exports and break client
 * component bundling.
 */

// Source: @/modules/visibility/benchmark.types
export type ComparisonPeriod = 'previous_period' | 'previous_week' | 'previous_month';

// Source: @/modules/visibility/benchmark.types
export interface BenchmarkFilters {
  promptSetId: string;
  platformId?: string;
  locale?: string;
  from?: string;
  to?: string;
  comparisonPeriod?: ComparisonPeriod;
}

// Source: @/modules/visibility/benchmark.types
export interface PlatformBenchmark {
  platformId: string;
  sharePercentage: string;
  delta: string | null;
  citationCount: number;
}

// Source: @/modules/visibility/benchmark.types
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

// Source: @/modules/visibility/benchmark.types
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

// Source: @/modules/visibility/benchmark.types
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

// Source: @/modules/visibility/benchmark.types
export interface PresenceMatrixFilters {
  promptSetId: string;
  brandIds?: string[];
  platformId?: string;
  from?: string;
  to?: string;
}

/**
 * UI-specific filter type used by the benchmark view.
 * Matches BenchmarkFilters — tab state is managed separately via nuqs.
 */
export type BenchmarkViewFilters = BenchmarkFilters;
