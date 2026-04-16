import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse } from '@/lib/query/types';
import type {
  BenchmarkFilters,
  BenchmarkResult,
  PresenceMatrixFilters,
  PresenceMatrixRow,
} from './benchmark.types';

export function fetchBenchmarks(filters: BenchmarkFilters): Promise<BenchmarkResult> {
  const params = new URLSearchParams();

  params.set('promptSetId', filters.promptSetId);
  if (filters.platformId) params.set('platformId', filters.platformId);
  if (filters.locale) params.set('locale', filters.locale);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.comparisonPeriod) params.set('comparisonPeriod', filters.comparisonPeriod);

  return apiFetch<BenchmarkResult>(`/visibility/benchmarks?${params.toString()}`);
}

export function fetchPresenceMatrix(
  filters: PresenceMatrixFilters & { page?: number; limit?: number }
): Promise<PaginatedResponse<PresenceMatrixRow>> {
  const params: Record<string, string | number> = {
    promptSetId: filters.promptSetId,
  };

  if (filters.brandIds?.length) params.brandIds = filters.brandIds.join(',');
  if (filters.platformId) params.platformId = filters.platformId;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.page) params.page = filters.page;
  if (filters.limit) params.limit = filters.limit;

  return apiFetchPaginated<PresenceMatrixRow>('/visibility/benchmarks/presence', params);
}

/**
 * Derives platform filter options from the benchmark response.
 * Returns an empty array when brands have no platformBreakdown
 * (i.e., a platform filter is already active).
 */
export function extractPlatformOptions(
  data: BenchmarkResult
): Array<{ value: string; label: string }> {
  const platformIds = new Set<string>();

  for (const brand of data.brands) {
    if (brand.platformBreakdown) {
      for (const pb of brand.platformBreakdown) {
        platformIds.add(pb.platformId);
      }
    }
  }

  return Array.from(platformIds)
    .sort()
    .map((id) => ({ value: id, label: id }));
}
