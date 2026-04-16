'use client';

import { useTranslations } from 'next-intl';

import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchableSelectFilter } from '@/components/filters/searchable-select-filter';
import type { DashboardFilters } from '../dashboard.types';

interface DashboardFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  promptSetOptions: Array<{ value: string; label: string }>;
  promptSetLoading: boolean;
}

export function DashboardFilterBar({
  filters,
  onFiltersChange,
  promptSetOptions,
  promptSetLoading,
}: DashboardFiltersProps) {
  const t = useTranslations('dashboard');

  const activeCount = [filters.promptSetId, filters.from, filters.to].filter(Boolean).length;

  return (
    <FilterBar
      activeCount={activeCount}
      onClearAll={() => onFiltersChange({ promptSetId: undefined, from: undefined, to: undefined })}
    >
      {promptSetOptions.length > 0 && !promptSetLoading && (
        <SearchableSelectFilter
          options={promptSetOptions}
          value={filters.promptSetId ?? ''}
          onChange={(value) => onFiltersChange({ ...filters, promptSetId: value || undefined })}
          label={t('filters.promptSet')}
          placeholder={t('filters.promptSetPlaceholder')}
        />
      )}
      <DateRangeFilter
        from={filters.from ? new Date(filters.from) : undefined}
        to={filters.to ? new Date(filters.to) : undefined}
        onChange={(range) =>
          onFiltersChange({
            ...filters,
            from: range.from?.toISOString().split('T')[0],
            to: range.to?.toISOString().split('T')[0],
          })
        }
        label={t('filters.dateRange')}
      />
    </FilterBar>
  );
}
