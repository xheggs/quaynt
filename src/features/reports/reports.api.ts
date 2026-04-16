import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import { ApiError } from '@/lib/query/types';
import type { PaginatedResponse, QueryFilters } from '@/lib/query/types';
import type {
  ReportJob,
  ReportGenerateInput,
  ReportSchedule,
  ReportScheduleCreate,
  ReportScheduleUpdate,
  ReportDelivery,
  ExportType,
  ReportTemplate,
  ReportTemplateCreate,
  ReportTemplateUpdate,
  LogoUploadResponse,
} from './reports.types';

// --- Report Jobs (PDF) ---

export interface FetchReportJobsParams extends QueryFilters {
  status?: string;
}

export function fetchReportJobs(
  params?: FetchReportJobsParams
): Promise<PaginatedResponse<ReportJob>> {
  return apiFetchPaginated<ReportJob>('/reports/pdf', { ...params });
}

export function generatePdfReport(input: ReportGenerateInput): Promise<ReportJob> {
  return apiFetch<ReportJob>('/reports/pdf', { method: 'POST', body: input });
}

export function fetchReportJob(jobId: string): Promise<ReportJob> {
  return apiFetch<ReportJob>(`/reports/pdf/${jobId}`);
}

export function buildReportDownloadUrl(jobId: string): string {
  return `/api/v1/reports/pdf/${jobId}/download`;
}

// --- Exports (CSV/JSON/JSONL) ---

export function buildExportUrl(
  params: { type: ExportType; format: 'csv' | 'json' | 'jsonl' } & Record<string, string>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  return `/api/v1/exports?${searchParams.toString()}`;
}

// --- Report Schedules ---

export interface FetchReportSchedulesParams extends QueryFilters {
  enabled?: string;
}

export function fetchReportSchedules(
  params?: FetchReportSchedulesParams
): Promise<PaginatedResponse<ReportSchedule>> {
  return apiFetchPaginated<ReportSchedule>('/reports/schedules', { ...params });
}

export function fetchReportSchedule(id: string): Promise<ReportSchedule> {
  return apiFetch<ReportSchedule>(`/reports/schedules/${id}`);
}

export function createReportSchedule(input: ReportScheduleCreate): Promise<ReportSchedule> {
  return apiFetch<ReportSchedule>('/reports/schedules', {
    method: 'POST',
    body: input,
  });
}

export function updateReportSchedule(
  id: string,
  input: ReportScheduleUpdate
): Promise<ReportSchedule> {
  return apiFetch<ReportSchedule>(`/reports/schedules/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteReportSchedule(id: string): Promise<void> {
  return apiFetch<void>(`/reports/schedules/${id}`, { method: 'DELETE' });
}

export function triggerReportSchedule(id: string): Promise<void> {
  return apiFetch<void>(`/reports/schedules/${id}/trigger`, { method: 'POST' });
}

// --- Schedule Deliveries ---

export function fetchScheduleDeliveries(
  scheduleId: string,
  params?: QueryFilters
): Promise<PaginatedResponse<ReportDelivery>> {
  return apiFetchPaginated<ReportDelivery>(`/reports/schedules/${scheduleId}/deliveries`, {
    ...params,
  });
}

// --- Report Templates ---

export interface FetchReportTemplatesParams extends QueryFilters {
  search?: string;
}

export function fetchReportTemplates(
  params?: FetchReportTemplatesParams
): Promise<PaginatedResponse<ReportTemplate>> {
  return apiFetchPaginated<ReportTemplate>('/reports/templates', { ...params });
}

export function fetchReportTemplate(id: string): Promise<ReportTemplate> {
  return apiFetch<ReportTemplate>(`/reports/templates/${id}`);
}

export function createReportTemplate(input: ReportTemplateCreate): Promise<ReportTemplate> {
  return apiFetch<ReportTemplate>('/reports/templates', {
    method: 'POST',
    body: input,
  });
}

export function updateReportTemplate(
  id: string,
  input: ReportTemplateUpdate
): Promise<ReportTemplate> {
  return apiFetch<ReportTemplate>(`/reports/templates/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export function deleteReportTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/reports/templates/${id}`, { method: 'DELETE' });
}

export function duplicateReportTemplate(id: string): Promise<ReportTemplate> {
  return apiFetch<ReportTemplate>(`/reports/templates/${id}/duplicate`, {
    method: 'POST',
  });
}

export async function uploadTemplateLogo(file: File): Promise<LogoUploadResponse> {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await fetch('/api/v1/reports/templates/logo', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'Logo upload failed' },
    }));
    throw new ApiError(
      errorBody.error.code,
      errorBody.error.message,
      response.status,
      errorBody.error.details
    );
  }

  return response.json();
}

export function deleteTemplateLogo(templateId: string): Promise<void> {
  return apiFetch<void>(`/reports/templates/${templateId}/logo`, {
    method: 'DELETE',
  });
}

export async function fetchTemplatePreview(templateId: string): Promise<Blob> {
  const response = await fetch(`/api/v1/reports/templates/${templateId}/preview`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({
      error: { code: 'UNKNOWN', message: 'Preview generation failed' },
    }));
    throw new ApiError(
      errorBody.error.code,
      errorBody.error.message,
      response.status,
      errorBody.error.details
    );
  }

  return response.blob();
}
