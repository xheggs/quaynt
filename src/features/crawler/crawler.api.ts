import { apiFetch } from '@/lib/query/fetch';
import type {
  CrawlerUpload,
  AnalyticsSummary,
  TimeSeriesPoint,
  BotBreakdownEntry,
  TopPageEntry,
  CoverageGapEntry,
  AnalyticsFilters,
  PushVisitResult,
  UploadStatus,
} from './crawler.types';

// --- Uploads ---

export async function uploadCrawlerLog(
  file: File,
  format?: string
): Promise<{ data: { uploadId: string; filename: string; format: string; status: string } }> {
  const formData = new FormData();
  formData.append('logFile', file);
  if (format) formData.append('format', format);

  const response = await fetch('/api/v1/crawler/uploads', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Upload failed' } }));
    throw new Error(error.error?.message ?? `Upload failed (${response.status})`);
  }

  return response.json();
}

export async function listUploads(params?: {
  page?: number;
  limit?: number;
  status?: UploadStatus;
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return apiFetch<{ data: CrawlerUpload[]; meta: { page: number; limit: number; total: number } }>(
    `/crawler/uploads${query ? `?${query}` : ''}`
  );
}

export async function getUpload(uploadId: string) {
  return apiFetch<{ data: CrawlerUpload }>(`/crawler/uploads/${uploadId}`);
}

export async function cancelUpload(uploadId: string) {
  return apiFetch<{ data: { uploadId: string; status: string } }>(`/crawler/uploads/${uploadId}`, {
    method: 'POST',
  });
}

export async function deleteUpload(uploadId: string) {
  return apiFetch<void>(`/crawler/uploads/${uploadId}`, { method: 'DELETE' });
}

// --- Visits ---

export async function pushVisits(
  visits: Array<{
    userAgent: string;
    requestPath: string;
    visitedAt: string;
    botName?: string;
    requestMethod?: string;
    statusCode?: number;
    responseBytes?: number;
  }>
) {
  return apiFetch<{ data: PushVisitResult }>('/crawler/visits', {
    method: 'POST',
    body: { visits },
  });
}

// --- Analytics ---

function buildAnalyticsParams(filters: AnalyticsFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.botName) params.set('botName', filters.botName);
  if (filters.botCategory) params.set('botCategory', filters.botCategory);
  return params.toString();
}

export async function getAnalyticsSummary(filters: AnalyticsFilters) {
  const query = buildAnalyticsParams(filters);
  return apiFetch<{ data: AnalyticsSummary }>(`/crawler/analytics/summary?${query}`);
}

export async function getTimeSeries(filters: AnalyticsFilters) {
  const query = buildAnalyticsParams(filters);
  return apiFetch<{ data: TimeSeriesPoint[] }>(`/crawler/analytics/timeseries?${query}`);
}

export async function getBotBreakdown(filters: AnalyticsFilters) {
  const query = buildAnalyticsParams(filters);
  return apiFetch<{ data: BotBreakdownEntry[] }>(`/crawler/analytics/bots?${query}`);
}

export async function getTopPages(filters: AnalyticsFilters, limit?: number) {
  const query = buildAnalyticsParams(filters);
  const limitParam = limit ? `&limit=${limit}` : '';
  return apiFetch<{ data: TopPageEntry[] }>(`/crawler/analytics/top-pages?${query}${limitParam}`);
}

export async function getCoverageGaps(filters: AnalyticsFilters) {
  const query = buildAnalyticsParams(filters);
  return apiFetch<{ data: CoverageGapEntry[] }>(`/crawler/analytics/coverage-gaps?${query}`);
}
