import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse, QueryFilters } from '@/lib/query/types';
import type {
  ModelRun,
  ModelRunDetail,
  ModelRunResult,
  CreateModelRunInput,
  AdapterConfig,
} from './model-run.types';

export interface ModelRunFilters extends QueryFilters {
  status?: string;
  promptSetId?: string;
  brandId?: string;
  locale?: string;
}

export interface ResultFilters extends QueryFilters {
  status?: string;
  adapterConfigId?: string;
}

export function fetchModelRuns(params: ModelRunFilters): Promise<PaginatedResponse<ModelRun>> {
  return apiFetchPaginated<ModelRun>('/model-runs', { ...params });
}

export function fetchModelRun(id: string): Promise<ModelRunDetail> {
  return apiFetch<ModelRunDetail>(`/model-runs/${id}`);
}

export function createModelRun(input: CreateModelRunInput): Promise<ModelRun> {
  return apiFetch<ModelRun>('/model-runs', { method: 'POST', body: input });
}

export function cancelModelRun(id: string): Promise<ModelRun> {
  return apiFetch<ModelRun>(`/model-runs/${id}/cancel`, { method: 'POST' });
}

export function fetchModelRunResults(
  runId: string,
  params: ResultFilters
): Promise<PaginatedResponse<ModelRunResult>> {
  return apiFetchPaginated<ModelRunResult>(`/model-runs/${runId}/results`, {
    ...params,
  });
}

export function fetchAdapterConfigs(
  params?: QueryFilters
): Promise<PaginatedResponse<AdapterConfig>> {
  return apiFetchPaginated<AdapterConfig>('/adapters', { ...params });
}
