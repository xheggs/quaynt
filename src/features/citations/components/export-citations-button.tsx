'use client';

import { ExportButton } from '@/components/export-button';
import type { CitationListFilters } from '../citation.types';

interface ExportCitationsButtonProps {
  filters: CitationListFilters;
  totalCount: number;
  disabled?: boolean;
}

export function ExportCitationsButton({
  filters,
  totalCount,
  disabled,
}: ExportCitationsButtonProps) {
  // Build filter params from citation-specific filters
  const exportFilters: Record<string, string> = {};
  if (filters.brandId) exportFilters.brandId = filters.brandId;
  if (filters.platformId) exportFilters.platformId = filters.platformId;
  if (filters.from) exportFilters.from = filters.from;
  if (filters.to) exportFilters.to = filters.to;
  if (filters.search) exportFilters.search = filters.search;
  if (filters.citationType) exportFilters.citationType = filters.citationType;
  if (filters.sentiment) exportFilters.sentiment = filters.sentiment;

  return (
    <ExportButton
      exportType="citations"
      filters={exportFilters}
      formats={['csv']}
      totalCount={totalCount}
      disabled={disabled}
    />
  );
}
