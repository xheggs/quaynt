import { apiFetch } from '@/lib/query/fetch';
import type {
  OpportunityFilters,
  OpportunityResult,
  OpportunitySortField,
} from './opportunity.types';

export interface FetchOpportunitiesParams extends OpportunityFilters {
  page?: number;
  limit?: number;
  sort?: OpportunitySortField;
  order?: 'asc' | 'desc';
}

export function fetchOpportunities(filters: FetchOpportunitiesParams): Promise<OpportunityResult> {
  const params = new URLSearchParams();

  params.set('promptSetId', filters.promptSetId);
  params.set('brandId', filters.brandId);
  if (filters.type) params.set('type', filters.type);
  if (filters.minCompetitorCount)
    params.set('minCompetitorCount', String(filters.minCompetitorCount));
  if (filters.platformId) params.set('platformId', filters.platformId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.order) params.set('order', filters.order);

  return apiFetch<OpportunityResult>(`/visibility/opportunities?${params.toString()}`);
}

/**
 * Derives platform filter options from opportunity results.
 * Returns unique platform IDs found across all opportunities' platform breakdowns.
 */
export function extractPlatformOptions(
  data: OpportunityResult
): Array<{ value: string; label: string }> {
  const platformIds = new Set<string>();

  for (const opportunity of data.data) {
    for (const pb of opportunity.platformBreakdown) {
      platformIds.add(pb.platformId);
    }
  }

  return Array.from(platformIds)
    .sort()
    .map((id) => ({ value: id, label: id }));
}
