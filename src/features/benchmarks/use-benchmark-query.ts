'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { fetchBenchmarks, fetchPresenceMatrix, extractPlatformOptions } from './benchmark.api';
import type { BenchmarkFilters, BenchmarkResult, PresenceMatrixFilters } from './benchmark.types';

export function useBenchmarkQuery(filters: BenchmarkFilters) {
  return useQuery({
    queryKey: queryKeys.benchmarks.list(filters as unknown as Record<string, unknown>),
    queryFn: () => fetchBenchmarks(filters),
    enabled: !!filters.promptSetId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      // Do not retry auth failures or bad requests
      if (
        error &&
        'status' in error &&
        ((error as { status: number }).status === 403 ||
          (error as { status: number }).status === 400)
      ) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function usePresenceMatrixQuery(
  filters: PresenceMatrixFilters & { page?: number; limit?: number }
) {
  return useQuery({
    queryKey: queryKeys.benchmarks.list({
      ...filters,
      _scope: 'presence',
    } as unknown as Record<string, unknown>),
    queryFn: () => fetchPresenceMatrix(filters),
    enabled: !!filters.promptSetId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (
        error &&
        'status' in error &&
        ((error as { status: number }).status === 403 ||
          (error as { status: number }).status === 400)
      ) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

export function usePlatformOptions(benchmarkData: BenchmarkResult | undefined) {
  return useMemo(
    () => (benchmarkData ? extractPlatformOptions(benchmarkData) : []),
    [benchmarkData]
  );
}
