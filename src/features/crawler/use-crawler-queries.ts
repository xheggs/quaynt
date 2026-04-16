import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  listUploads,
  getUpload,
  uploadCrawlerLog,
  cancelUpload,
  deleteUpload,
  getAnalyticsSummary,
  getTimeSeries,
  getBotBreakdown,
  getTopPages,
  getCoverageGaps,
} from './crawler.api';
import type { AnalyticsFilters, UploadStatus } from './crawler.types';

// --- Upload Queries ---

export function useUploadsQuery(params?: { page?: number; limit?: number; status?: UploadStatus }) {
  return useQuery({
    queryKey: queryKeys.crawlerUploads.list(params ?? {}),
    queryFn: () => listUploads(params),
  });
}

export function useUploadDetailQuery(uploadId: string | null) {
  return useQuery({
    queryKey: queryKeys.crawlerUploads.detail(uploadId ?? ''),
    queryFn: () => getUpload(uploadId!),
    enabled: !!uploadId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (status === 'pending' || status === 'processing') return 3000;
      return false;
    },
  });
}

export function useUploadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, format }: { file: File; format?: string }) =>
      uploadCrawlerLog(file, format),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crawlerUploads.all });
    },
  });
}

export function useCancelUploadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uploadId: string) => cancelUpload(uploadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crawlerUploads.all });
    },
  });
}

export function useDeleteUploadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uploadId: string) => deleteUpload(uploadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crawlerUploads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.crawlerAnalytics.all });
    },
  });
}

// --- Analytics Queries ---

export function useSummaryQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.crawlerAnalytics.list({ type: 'summary', ...filters }),
    queryFn: () => getAnalyticsSummary(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTimeSeriesQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.crawlerAnalytics.list({ type: 'timeseries', ...filters }),
    queryFn: () => getTimeSeries(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBotBreakdownQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.crawlerAnalytics.list({ type: 'bots', ...filters }),
    queryFn: () => getBotBreakdown(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTopPagesQuery(filters: AnalyticsFilters, limit?: number) {
  return useQuery({
    queryKey: queryKeys.crawlerAnalytics.list({ type: 'topPages', ...filters, limit }),
    queryFn: () => getTopPages(filters, limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCoverageGapsQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.crawlerAnalytics.list({ type: 'coverageGaps', ...filters }),
    queryFn: () => getCoverageGaps(filters),
    staleTime: 5 * 60 * 1000,
  });
}
