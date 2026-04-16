'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { fetchDashboard, fetchPromptSets } from './dashboard.api';
import type { DashboardFilters } from './dashboard.types';

export function useDashboardQuery(filters: DashboardFilters) {
  return useQuery({
    queryKey: queryKeys.dashboard.list(filters as Record<string, unknown>),
    queryFn: () => fetchDashboard(filters),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function usePromptSetOptions() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.promptSets.lists(),
    queryFn: fetchPromptSets,
    staleTime: 10 * 60 * 1000,
    select: (response) => response.data.map((ps) => ({ value: ps.id, label: ps.name })),
  });

  return { options: data ?? [], isLoading };
}
