'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  fetchDualScore,
  fetchDualScoreHistory,
  fetchDualScoreQueries,
  fetchDualScoreRecommendations,
  type DualQueriesSort,
} from './dual-score.api';
import type { GapSignal, Granularity } from './dual-score.types';

const STALE_MS = 5 * 60 * 1000;

export function useDualScoreQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}) {
  return useQuery({
    queryKey: queryKeys.dualScore.list(filters as unknown as Record<string, unknown>),
    queryFn: () => fetchDualScore(filters),
    enabled: !!filters.brandId,
    staleTime: STALE_MS,
  });
}

export function useDualScoreHistoryQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: queryKeys.dualScore.list({
      ...filters,
      _scope: 'history',
    } as unknown as Record<string, unknown>),
    queryFn: () => fetchDualScoreHistory(filters),
    enabled: !!filters.brandId && !!filters.from && !!filters.to,
    staleTime: STALE_MS,
  });
}

export function useDualScoreQueriesQuery(filters: {
  brandId: string;
  from: string;
  to: string;
  gapSignal?: GapSignal;
  sort?: DualQueriesSort;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.dualScore.list({
      ...filters,
      _scope: 'queries',
    } as unknown as Record<string, unknown>),
    queryFn: () => fetchDualScoreQueries(filters),
    enabled: !!filters.brandId && !!filters.from && !!filters.to,
    staleTime: STALE_MS,
  });
}

export function useDualScoreRecommendationsQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}) {
  return useQuery({
    queryKey: queryKeys.dualScore.list({
      ...filters,
      _scope: 'recommendations',
    } as unknown as Record<string, unknown>),
    queryFn: () => fetchDualScoreRecommendations(filters),
    enabled: !!filters.brandId,
    staleTime: STALE_MS,
  });
}
