import { apiFetch } from '@/lib/query/fetch';
import type {
  GeoScoreHistoryResponse,
  GeoScoreRecommendationsResponse,
  GeoScoreResponse,
  Granularity,
} from './geo-score.types';

export function fetchGeoScore(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}): Promise<GeoScoreResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  if (filters.at) params.set('at', filters.at);
  return apiFetch<GeoScoreResponse>(`/visibility/geo-score?${params.toString()}`);
}

export function fetchGeoScoreHistory(filters: {
  brandId: string;
  granularity?: Granularity;
  from: string;
  to: string;
}): Promise<GeoScoreHistoryResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  params.set('from', filters.from);
  params.set('to', filters.to);
  return apiFetch<GeoScoreHistoryResponse>(`/visibility/geo-score/history?${params.toString()}`);
}

export function fetchGeoScoreRecommendations(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}): Promise<GeoScoreRecommendationsResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  if (filters.at) params.set('at', filters.at);
  return apiFetch<GeoScoreRecommendationsResponse>(
    `/visibility/geo-score/recommendations?${params.toString()}`
  );
}

export function recomputeGeoScore(body: {
  brandId: string;
  granularity?: Granularity;
  periodStart?: string;
}): Promise<{ status: string; brandId: string; periodStart: string; granularity: Granularity }> {
  return apiFetch(`/visibility/geo-score`, {
    method: 'POST',
    body,
  });
}
