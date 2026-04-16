'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import {
  fetchAlertRules,
  fetchAlertRule,
  fetchAlertEvents,
  fetchAlertSummary,
  fetchNotificationPreferences,
} from './alerts.api';
import type { FetchAlertRulesParams, FetchAlertEventsParams } from './alerts.api';
import type {
  AlertRule,
  AlertEvent,
  AlertSummary,
  NotificationPreferencesResponse,
} from './alerts.types';

export function useAlertRulesQuery(
  extraFilters?: Pick<FetchAlertRulesParams, 'metric' | 'enabled'>
) {
  return usePaginatedQuery<AlertRule>({
    queryKey: (params) => queryKeys.alerts.list({ ...params, ...extraFilters }),
    queryFn: (params) => fetchAlertRules({ ...params, ...extraFilters }),
    defaultSort: 'createdAt',
  });
}

export function useAlertRuleQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.alerts.detail(id ?? ''),
    queryFn: () => fetchAlertRule(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
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

export function useAlertEventsQuery(
  extraFilters?: Pick<FetchAlertEventsParams, 'alertRuleId' | 'severity' | 'status'>
) {
  return usePaginatedQuery<AlertEvent>({
    queryKey: (params) => queryKeys.alertEvents.list({ ...params, ...extraFilters }),
    queryFn: (params) => fetchAlertEvents({ ...params, ...extraFilters }),
    defaultSort: 'triggeredAt',
    refetchInterval: 30_000,
  });
}

export function useAlertSummaryQuery(params?: { from?: string; to?: string }) {
  return useQuery<AlertSummary>({
    queryKey: ['alerts', 'summary', params],
    queryFn: () => fetchAlertSummary(params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationPreferencesQuery() {
  return useQuery<NotificationPreferencesResponse>({
    queryKey: queryKeys.notificationPreferences.all,
    queryFn: () => fetchNotificationPreferences(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
