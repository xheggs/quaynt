import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse, QueryFilters } from '@/lib/query/types';
import type { Brand, CreateBrandInput, UpdateBrandInput } from './brand.types';

export function fetchBrands(params: QueryFilters): Promise<PaginatedResponse<Brand>> {
  return apiFetchPaginated<Brand>('/brands', { ...params });
}

export function fetchBrand(id: string): Promise<Brand> {
  return apiFetch<Brand>(`/brands/${id}`);
}

export function createBrand(input: CreateBrandInput): Promise<Brand> {
  return apiFetch<Brand>('/brands', { method: 'POST', body: input });
}

export function updateBrand(id: string, input: UpdateBrandInput): Promise<Brand> {
  return apiFetch<Brand>(`/brands/${id}`, { method: 'PATCH', body: input });
}

export function deleteBrand(id: string): Promise<void> {
  return apiFetch<void>(`/brands/${id}`, { method: 'DELETE' });
}
