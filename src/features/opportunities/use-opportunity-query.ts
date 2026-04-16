'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { fetchOpportunities, extractPlatformOptions } from './opportunity.api';
import type {
  OpportunityFilters,
  OpportunityResult,
  OpportunitySortField,
} from './opportunity.types';

export interface UseOpportunityQueryParams extends OpportunityFilters {
  page?: number;
  limit?: number;
  sort?: OpportunitySortField;
  order?: 'asc' | 'desc';
}

export function useOpportunityQuery(filters: UseOpportunityQueryParams) {
  return useQuery({
    queryKey: queryKeys.opportunities.list(filters as unknown as Record<string, unknown>),
    queryFn: () => fetchOpportunities(filters),
    enabled: !!filters.promptSetId && !!filters.brandId,
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

export function usePlatformOptions(opportunityData: OpportunityResult | undefined) {
  return useMemo(
    () => (opportunityData ? extractPlatformOptions(opportunityData) : []),
    [opportunityData]
  );
}
