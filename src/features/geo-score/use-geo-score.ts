'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  fetchGeoScore,
  fetchGeoScoreHistory,
  fetchGeoScoreRecommendations,
  recomputeGeoScore,
} from './geo-score.api';
import type { Granularity } from './geo-score.types';

export function useGeoScoreQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}) {
  return useQuery({
    queryKey: queryKeys.geoScore.list(filters as unknown as Record<string, unknown>),
    queryFn: () => fetchGeoScore(filters),
    enabled: !!filters.brandId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGeoScoreHistoryQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: queryKeys.geoScore.list({
      ...filters,
      _scope: 'history',
    } as unknown as Record<string, unknown>),
    queryFn: () => fetchGeoScoreHistory(filters),
    enabled: !!filters.brandId && !!filters.from && !!filters.to,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGeoScoreRecommendationsQuery(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}) {
  return useQuery({
    queryKey: queryKeys.geoScore.list({
      ...filters,
      _scope: 'recommendations',
    } as unknown as Record<string, unknown>),
    queryFn: () => fetchGeoScoreRecommendations(filters),
    enabled: !!filters.brandId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecomputeGeoScoreMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recomputeGeoScore,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.geoScore.all });
    },
  });
}
