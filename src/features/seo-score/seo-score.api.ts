import { apiFetch } from '@/lib/query/fetch';
import type {
  Granularity,
  SeoScoreHistoryResponse,
  SeoScoreRecommendationsResponse,
  SeoScoreRecomputeResponse,
  SeoScoreResponse,
} from './seo-score.types';

export function fetchSeoScore(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}): Promise<SeoScoreResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  if (filters.at) params.set('at', filters.at);
  return apiFetch<SeoScoreResponse>(`/visibility/seo-score?${params.toString()}`);
}

export function fetchSeoScoreHistory(filters: {
  brandId: string;
  granularity?: Granularity;
  from: string;
  to: string;
}): Promise<SeoScoreHistoryResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  params.set('from', filters.from);
  params.set('to', filters.to);
  return apiFetch<SeoScoreHistoryResponse>(`/visibility/seo-score/history?${params.toString()}`);
}

export function fetchSeoScoreRecommendations(filters: {
  brandId: string;
  granularity?: Granularity;
  at?: string;
}): Promise<SeoScoreRecommendationsResponse> {
  const params = new URLSearchParams();
  params.set('brandId', filters.brandId);
  if (filters.granularity) params.set('granularity', filters.granularity);
  if (filters.at) params.set('at', filters.at);
  return apiFetch<SeoScoreRecommendationsResponse>(
    `/visibility/seo-score/recommendations?${params.toString()}`
  );
}

export function recomputeSeoScore(body: {
  brandId: string;
  granularity?: Granularity;
  periodStart?: string;
}): Promise<SeoScoreRecomputeResponse> {
  return apiFetch(`/visibility/seo-score`, {
    method: 'POST',
    body,
  });
}
