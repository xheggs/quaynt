import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse } from '@/lib/query/types';
import type { DashboardFilters, DashboardResponse } from './dashboard.types';

export function fetchDashboard(filters?: DashboardFilters): Promise<DashboardResponse> {
  const params = new URLSearchParams();

  if (filters?.promptSetId) params.set('promptSetId', filters.promptSetId);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);

  const qs = params.toString();
  return apiFetch<DashboardResponse>(qs ? `/dashboard?${qs}` : '/dashboard');
}

export function fetchPromptSets(): Promise<PaginatedResponse<{ id: string; name: string }>> {
  return apiFetchPaginated<{ id: string; name: string }>('/prompt-sets', {
    limit: 100,
  });
}
