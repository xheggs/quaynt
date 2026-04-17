import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  TimeSeriesPoint,
  PlatformBreakdownEntry,
  TopPageEntry,
  RecentVisitEntry,
  SiteKey,
  SiteKeyCreated,
  VisitListFilters,
} from './traffic.types';

// --- Analytics ---

function buildAnalyticsParams(filters: AnalyticsFilters & { limit?: number }): string {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.source) params.set('source', filters.source);
  if (filters.limit) params.set('limit', String(filters.limit));
  return params.toString();
}

export function getAnalyticsSummary(filters: AnalyticsFilters) {
  return apiFetch<AnalyticsSummary>(`/traffic/analytics/summary?${buildAnalyticsParams(filters)}`);
}

export function getTimeSeries(filters: AnalyticsFilters) {
  return apiFetch<TimeSeriesPoint[]>(
    `/traffic/analytics/timeseries?${buildAnalyticsParams(filters)}`
  );
}

export function getPlatformBreakdown(filters: AnalyticsFilters) {
  return apiFetch<PlatformBreakdownEntry[]>(
    `/traffic/analytics/platforms?${buildAnalyticsParams(filters)}`
  );
}

export function getTopLandingPages(filters: AnalyticsFilters, limit = 20) {
  return apiFetch<TopPageEntry[]>(
    `/traffic/analytics/top-pages?${buildAnalyticsParams({ ...filters, limit })}`
  );
}

// --- Visits ---

export function listVisits(filters: VisitListFilters, page = 1, limit = 25) {
  return apiFetchPaginated<RecentVisitEntry>('/traffic/visits', { ...filters, page, limit });
}

// --- Site keys ---

export function listSiteKeys(params?: { page?: number; limit?: number }) {
  return apiFetchPaginated<SiteKey>('/traffic/site-keys', params);
}

export function createSiteKey(input: { name: string; allowedOrigins?: string[] }) {
  return apiFetch<SiteKeyCreated>('/traffic/site-keys', {
    method: 'POST',
    body: input,
  });
}

export function updateSiteKey(
  siteKeyId: string,
  input: { name?: string; allowedOrigins?: string[] }
) {
  return apiFetch<SiteKey>(`/traffic/site-keys/${siteKeyId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function revokeSiteKey(siteKeyId: string) {
  return apiFetch<void>(`/traffic/site-keys/${siteKeyId}`, { method: 'DELETE' });
}

// --- GSC correlation ---

export interface GscCorrelationFilters {
  from: string;
  to: string;
  propertyUrl?: string;
}

export interface GscCorrelationSummary {
  aiCitedClicks: number;
  aiCitedImpressions: number;
  avgPosition: number | null;
  distinctQueries: number;
  gapQueries: number;
}

export interface GscCorrelationTimeSeriesPoint {
  date: string;
  aiCitedClicks: number;
  aiCitedImpressions: number;
  allClicks: number;
  allImpressions: number;
}

export interface GscTopQueryEntry {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  aiCitationCount: number;
  firstDetectedAt: string | null;
}

function buildGscParams(
  filters: GscCorrelationFilters & { page?: number; limit?: number }
): string {
  const p = new URLSearchParams();
  p.set('from', filters.from);
  p.set('to', filters.to);
  if (filters.propertyUrl) p.set('propertyUrl', filters.propertyUrl);
  if (filters.page) p.set('page', String(filters.page));
  if (filters.limit) p.set('limit', String(filters.limit));
  return p.toString();
}

export function getGscCorrelationSummary(filters: GscCorrelationFilters) {
  return apiFetch<GscCorrelationSummary>(
    `/traffic/gsc/correlation/summary?${buildGscParams(filters)}`
  );
}

export function getGscCorrelationTimeSeries(filters: GscCorrelationFilters) {
  return apiFetch<GscCorrelationTimeSeriesPoint[]>(
    `/traffic/gsc/correlation/timeseries?${buildGscParams(filters)}`
  );
}

export function getGscTopQueries(filters: GscCorrelationFilters, page = 1, limit = 25) {
  return apiFetchPaginated<GscTopQueryEntry>(
    `/traffic/gsc/correlation/top-queries?${buildGscParams({ ...filters, page, limit })}`
  );
}

export function triggerGscSync(connectionId: string) {
  return apiFetch<{ enqueued: boolean; connectionId: string }>(
    `/integrations/gsc/connections/${connectionId}/sync`,
    { method: 'POST' }
  );
}
