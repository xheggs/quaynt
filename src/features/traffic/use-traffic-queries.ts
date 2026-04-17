import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  getAnalyticsSummary,
  getTimeSeries,
  getPlatformBreakdown,
  getTopLandingPages,
  listVisits,
  listSiteKeys,
  createSiteKey,
  updateSiteKey,
  revokeSiteKey,
  getGscCorrelationSummary,
  getGscCorrelationTimeSeries,
  getGscTopQueries,
  triggerGscSync,
  type GscCorrelationFilters,
} from './traffic.api';
import type { AnalyticsFilters, VisitListFilters } from './traffic.types';

// --- Analytics ---

const ANALYTICS_STALE_TIME = 5 * 60 * 1000;

export function useSummaryQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.trafficAnalytics.list({ type: 'summary', ...filters }),
    queryFn: () => getAnalyticsSummary(filters),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useTimeSeriesQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.trafficAnalytics.list({ type: 'timeseries', ...filters }),
    queryFn: () => getTimeSeries(filters),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function usePlatformsQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: queryKeys.trafficAnalytics.list({ type: 'platforms', ...filters }),
    queryFn: () => getPlatformBreakdown(filters),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useTopPagesQuery(filters: AnalyticsFilters, limit = 20) {
  return useQuery({
    queryKey: queryKeys.trafficAnalytics.list({ type: 'topPages', ...filters, limit }),
    queryFn: () => getTopLandingPages(filters, limit),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

// --- Visits ---

export function useRecentVisitsQuery(filters: VisitListFilters, page = 1, limit = 25) {
  return useQuery({
    queryKey: queryKeys.trafficVisits.list({ ...filters, page, limit }),
    queryFn: () => listVisits(filters, page, limit),
  });
}

// --- Site keys ---

export function useSiteKeysQuery(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.trafficSiteKeys.list(params ?? {}),
    queryFn: () => listSiteKeys(params),
  });
}

export function useCreateSiteKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSiteKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trafficSiteKeys.all });
    },
  });
}

export function useUpdateSiteKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteKeyId,
      input,
    }: {
      siteKeyId: string;
      input: { name?: string; allowedOrigins?: string[] };
    }) => updateSiteKey(siteKeyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trafficSiteKeys.all });
    },
  });
}

export function useRevokeSiteKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeSiteKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trafficSiteKeys.all });
    },
  });
}

// --- GSC correlation ---

export function useGscCorrelationSummaryQuery(filters: GscCorrelationFilters) {
  return useQuery({
    queryKey: queryKeys.gscCorrelation.list({ type: 'summary', ...filters }),
    queryFn: () => getGscCorrelationSummary(filters),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useGscCorrelationTimeSeriesQuery(filters: GscCorrelationFilters) {
  return useQuery({
    queryKey: queryKeys.gscCorrelation.list({ type: 'timeseries', ...filters }),
    queryFn: () => getGscCorrelationTimeSeries(filters),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useGscTopQueriesQuery(filters: GscCorrelationFilters, page = 1, limit = 25) {
  return useQuery({
    queryKey: queryKeys.gscCorrelation.list({ type: 'topQueries', ...filters, page, limit }),
    queryFn: () => getGscTopQueries(filters, page, limit),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useTriggerGscSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerGscSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gscCorrelation.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.gscConnections.all });
    },
  });
}
