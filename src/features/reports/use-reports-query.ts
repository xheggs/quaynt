'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useApiMutation } from '@/hooks/use-api-mutation';
import {
  fetchReportJobs,
  fetchReportJob,
  generatePdfReport,
  fetchReportSchedules,
  fetchScheduleDeliveries,
  fetchReportTemplates,
  fetchReportTemplate,
} from './reports.api';
import type {
  FetchReportJobsParams,
  FetchReportSchedulesParams,
  FetchReportTemplatesParams,
} from './reports.api';
import type { ReportJob, ReportSchedule, ReportDelivery, ReportTemplate } from './reports.types';

export function useReportJobsQuery(extraFilters?: Pick<FetchReportJobsParams, 'status'>) {
  return usePaginatedQuery<ReportJob>({
    queryKey: (params) => queryKeys.reportJobs.list({ ...params, ...extraFilters }),
    queryFn: (params) => fetchReportJobs({ ...params, ...extraFilters }),
    defaultSort: 'createdAt',
  });
}

export function useReportJobQuery(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.reportJobs.detail(jobId ?? ''),
    queryFn: () => fetchReportJob(jobId!),
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'processing') return 5000;
      return false;
    },
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

export function useGenerateReportMutation() {
  return useApiMutation({
    mutationFn: generatePdfReport,
    invalidateKeys: [queryKeys.reportJobs.lists()],
  });
}

export function useReportSchedulesQuery(
  extraFilters?: Pick<FetchReportSchedulesParams, 'enabled'>
) {
  return usePaginatedQuery<ReportSchedule>({
    queryKey: (params) => queryKeys.reportSchedules.list({ ...params, ...extraFilters }),
    queryFn: (params) => fetchReportSchedules({ ...params, ...extraFilters }),
    defaultSort: 'createdAt',
  });
}

export function useScheduleDeliveriesQuery(scheduleId: string, extraFilters?: { limit?: number }) {
  return usePaginatedQuery<ReportDelivery>({
    queryKey: (params) =>
      queryKeys.reportDeliveries.list({ scheduleId, ...params, ...extraFilters }),
    queryFn: (params) => fetchScheduleDeliveries(scheduleId, { ...params, ...extraFilters }),
    defaultSort: 'createdAt',
    defaultLimit: 10,
  });
}

// --- Report Templates ---

export function useReportTemplatesQuery(extraFilters?: Pick<FetchReportTemplatesParams, 'search'>) {
  return usePaginatedQuery<ReportTemplate>({
    queryKey: (params) => queryKeys.reportTemplates.list({ ...params, ...extraFilters }),
    queryFn: (params) => fetchReportTemplates({ ...params, ...extraFilters }),
    defaultSort: 'createdAt',
  });
}

export function useReportTemplateQuery(id: string | null) {
  return useQuery({
    queryKey: queryKeys.reportTemplates.detail(id ?? ''),
    queryFn: () => fetchReportTemplate(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
