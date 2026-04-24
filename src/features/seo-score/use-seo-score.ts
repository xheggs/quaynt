'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  fetchSeoScore,
  fetchSeoScoreHistory,
  fetchSeoScoreRecommendations,
  recomputeSeoScore,
} from './seo-score.api';
import type { Granularity } from './seo-score.types';

export function useSeoScoreQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}) {
  return useQuery({
    queryKey: queryKeys.seoScore.list(filters as unknown as Record<string, unknown>),
    queryFn: () => fetchSeoScore(filters),
    enabled: !!filters.brandId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSeoScoreHistoryQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: queryKeys.seoScore.list({
      ...filters,
      _scope: 'history',
    } as unknown as Record<string, unknown>),
    queryFn: () => fetchSeoScoreHistory(filters),
    enabled: !!filters.brandId && !!filters.from && !!filters.to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSeoScoreRecommendationsQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}) {
  return useQuery({
    queryKey: queryKeys.seoScore.list({
      ...filters,
      _scope: 'recommendations',
    } as unknown as Record<string, unknown>),
    queryFn: () => fetchSeoScoreRecommendations(filters),
    enabled: !!filters.brandId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecomputeSeoScoreMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recomputeSeoScore,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seoScore.all });
    },
  });
}
