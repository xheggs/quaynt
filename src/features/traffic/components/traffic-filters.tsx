'use client';

import { useTranslations } from 'next-intl';

import { FilterBar } from '@/components/filters/filter-bar';
import { SearchableSelectFilter } from '@/components/filters/searchable-select-filter';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import type { AnalyticsFilters, VisitSource } from '../traffic.types';
import { PLATFORM_DISPLAY_NAMES } from './platform-display';

interface Props {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: Partial<AnalyticsFilters>) => void;
  availablePlatforms?: string[];
}

const SOURCE_OPTIONS: Array<{ value: VisitSource; label: string }> = [
  { value: 'snippet', label: 'Snippet' },
  { value: 'log', label: 'Server logs' },
];

export function TrafficFilters({ filters, onFiltersChange, availablePlatforms }: Props) {
  const t = useTranslations('aiTraffic');

  const activeCount = [filters.platform, filters.source].filter(Boolean).length;

  const platformOptions = (availablePlatforms ?? Object.keys(PLATFORM_DISPLAY_NAMES)).map(
    (slug) => ({
      value: slug,
      label: PLATFORM_DISPLAY_NAMES[slug] ?? slug,
    })
  );

  return (
    <FilterBar
      activeCount={activeCount}
      onClearAll={() => onFiltersChange({ platform: undefined, source: undefined })}
    >
      <DateRangeFilter
        from={filters.from ? new Date(filters.from) : undefined}
        to={filters.to ? new Date(filters.to) : undefined}
        onChange={(range) =>
          onFiltersChange({
            from: range.from?.toISOString().slice(0, 10),
            to: range.to?.toISOString().slice(0, 10),
          })
        }
        label={t('filters.dateRange')}
      />
      <SearchableSelectFilter
        label={t('filters.platform')}
        placeholder={t('filters.allPlatforms')}
        options={platformOptions}
        value={filters.platform ?? ''}
        onChange={(value) => onFiltersChange({ platform: value || undefined })}
      />
      <SearchableSelectFilter
        label={t('filters.source')}
        placeholder={t('filters.allSources')}
        options={SOURCE_OPTIONS}
        value={filters.source ?? ''}
        onChange={(value) => onFiltersChange({ source: (value as VisitSource) || undefined })}
      />
    </FilterBar>
  );
}
