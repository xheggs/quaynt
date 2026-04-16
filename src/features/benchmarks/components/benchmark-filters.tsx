'use client';

import { useTranslations } from 'next-intl';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchableSelectFilter } from '@/components/filters/searchable-select-filter';
import { SelectFilter } from '@/components/filters/select-filter';
import type { BenchmarkViewFilters, ComparisonPeriod } from '../benchmark.types';

interface BenchmarkFiltersProps {
  filters: BenchmarkViewFilters;
  onFiltersChange: (filters: BenchmarkViewFilters) => void;
  promptSetOptions: Array<{ value: string; label: string }>;
  platformOptions: Array<{ value: string; label: string }>;
  promptSetLoading: boolean;
}

export function BenchmarkFilterBar({
  filters,
  onFiltersChange,
  promptSetOptions,
  platformOptions,
  promptSetLoading,
}: BenchmarkFiltersProps) {
  const t = useTranslations('benchmarks');

  const comparisonOptions = [
    { value: 'previous_period', label: t('filters.previousPeriod') },
    { value: 'previous_week', label: t('filters.previousWeek') },
    { value: 'previous_month', label: t('filters.previousMonth') },
  ];

  const platformFilterOptions = [
    { value: '', label: t('filters.platformAll') },
    ...platformOptions,
  ];

  const activeCount = [
    filters.platformId,
    filters.from,
    filters.to,
    filters.comparisonPeriod && filters.comparisonPeriod !== 'previous_period'
      ? filters.comparisonPeriod
      : undefined,
  ].filter(Boolean).length;

  return (
    <FilterBar
      activeCount={activeCount}
      onClearAll={() =>
        onFiltersChange({
          promptSetId: filters.promptSetId,
          platformId: undefined,
          from: undefined,
          to: undefined,
          comparisonPeriod: undefined,
        })
      }
    >
      {!promptSetLoading && (
        <SearchableSelectFilter
          options={promptSetOptions}
          value={filters.promptSetId ?? ''}
          onChange={(value) => onFiltersChange({ ...filters, promptSetId: value || '' })}
          label={t('filters.promptSet')}
          placeholder={t('filters.promptSetPlaceholder')}
        />
      )}
      {platformOptions.length > 0 && (
        <SearchableSelectFilter
          options={platformFilterOptions}
          value={filters.platformId ?? ''}
          onChange={(value) => onFiltersChange({ ...filters, platformId: value || undefined })}
          label={t('filters.platform')}
          placeholder={t('filters.platformAll')}
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
      <SelectFilter
        options={comparisonOptions}
        value={filters.comparisonPeriod ?? 'previous_period'}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            comparisonPeriod: value as ComparisonPeriod,
          })
        }
        label={t('filters.comparisonPeriod')}
      />
    </FilterBar>
  );
}
