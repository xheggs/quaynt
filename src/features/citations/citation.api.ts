import { apiFetch, apiFetchPaginated } from '@/lib/query/fetch';
import type { PaginatedResponse } from '@/lib/query/types';
import type { CitationRecord, CitationListFilters } from './citation.types';

export function fetchCitations(
  params: Record<string, unknown>
): Promise<PaginatedResponse<CitationRecord>> {
  return apiFetchPaginated<CitationRecord>('/citations', params);
}

export function fetchCitation(id: string): Promise<CitationRecord> {
  return apiFetch<CitationRecord>(`/citations/${id}`);
}

/**
 * Constructs the export URL for CSV download of citations matching the given filters.
 * The export API streams directly from the database — no client-side data needed.
 */
export function buildCitationExportUrl(filters: CitationListFilters): string {
  const params = new URLSearchParams();
  params.set('type', 'citations');
  params.set('format', 'csv');

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  return `/api/v1/exports?${params.toString()}`;
}
