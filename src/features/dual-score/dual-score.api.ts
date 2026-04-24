import { apiFetch } from '@/lib/query/fetch';
import type {
  DualCombinedRecommendationsResponse,
  DualHistoryResponse,
  DualQueriesResponse,
  DualScoreResponse,
  GapSignal,
  Granularity,
} from './dual-score.types';

export function fetchDualScore(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}): Promise<DualScoreResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  if (filters.at) params.set('at', filters.at);
  return apiFetch<DualScoreResponse>(`/visibility/dual-score?${params.toString()}`);
}

export function fetchDualScoreHistory(filters: {
  brandId: string;
  granularity?: Granularity;
  from: string;
  to: string;
}): Promise<DualHistoryResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  params.set('from', filters.from);
  params.set('to', filters.to);
  return apiFetch<DualHistoryResponse>(`/visibility/dual-score/history?${params.toString()}`);
}

export type DualQueriesSort = 'impressions' | 'aioCitationCount' | 'avgPosition' | 'gapSignal';

export function fetchDualScoreQueries(filters: {
  brandId: string;
  from: string;
  to: string;
  gapSignal?: GapSignal;
  sort?: DualQueriesSort;
  page?: number;
  limit?: number;
}): Promise<DualQueriesResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  params.set('from', filters.from);
  params.set('to', filters.to);
  if (filters.gapSignal) params.set('gapSignal', filters.gapSignal);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  return apiFetch<DualQueriesResponse>(`/visibility/dual-score/queries?${params.toString()}`);
}

export function fetchDualScoreRecommendations(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}): Promise<DualCombinedRecommendationsResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  if (filters.at) params.set('at', filters.at);
  return apiFetch<DualCombinedRecommendationsResponse>(
    `/visibility/dual-score/recommendations?${params.toString()}`
  );
}
