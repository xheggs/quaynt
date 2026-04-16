// Types
export type {
  BenchmarkResult,
  BrandBenchmark,
  BenchmarkFilters,
  PresenceMatrixRow,
  ComparisonPeriod,
} from './benchmark.types';

// API functions
export { fetchBenchmarks, fetchPresenceMatrix } from './benchmark.api';

// Hooks
export { useBenchmarkQuery, usePresenceMatrixQuery } from './use-benchmark-query';

// View
export { BenchmarkView } from './components/benchmark-view';
