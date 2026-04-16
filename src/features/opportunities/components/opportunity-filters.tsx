'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchableSelectFilter } from '@/components/filters/searchable-select-filter';
import { SelectFilter } from '@/components/filters/select-filter';
import { fetchBrands } from '@/features/brands/brand.api';
import type { OpportunityViewFilters } from '../opportunity.types';

interface OpportunityFiltersProps {
  filters: OpportunityViewFilters;
  onFiltersChange: (filters: OpportunityViewFilters) => void;
  promptSetOptions: Array<{ value: string; label: string }>;
  platformOptions: Array<{ value: string; label: string }>;
  promptSetLoading: boolean;
}

export function OpportunityFilterBar({
  filters,
  onFiltersChange,
  promptSetOptions,
  platformOptions,
  promptSetLoading,
}: OpportunityFiltersProps) {
  const t = useTranslations('opportunities');

  // Fetch brands for brand filter dropdown
  const { data: brandsData, isLoading: brandsLoading } = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100 }),
    queryFn: () => fetchBrands({ limit: 100 }),
  });

  const brandOptions = (brandsData?.data ?? []).map((brand) => ({
    label: brand.name,
    value: brand.id,
  }));

  const typeOptions = [
    { value: '__all__', label: t('filters.typeAll') },
    { value: 'missing', label: t('filters.typeMissing') },
    { value: 'weak', label: t('filters.typeWeak') },
  ];

  const minCompetitorOptions = [
    { value: '__any__', label: t('filters.minCompetitorsPlaceholder') },
    { value: '2', label: '2+' },
    { value: '3', label: '3+' },
    { value: '5', label: '5+' },
    { value: '10', label: '10+' },
  ];

  const platformFilterOptions = [
    { value: '', label: t('filters.platformAll') },
    ...platformOptions,
  ];

  // Count non-default, non-required filters
  const activeCount = [
    filters.platformId,
    filters.type,
    filters.minCompetitorCount,
    filters.from || filters.to,
  ].filter(Boolean).length;

  return (
    <FilterBar
      activeCount={activeCount}
      onClearAll={() =>
        onFiltersChange({
          promptSetId: filters.promptSetId,
          brandId: filters.brandId,
          platformId: undefined,
          type: undefined,
          minCompetitorCount: undefined,
          from: undefined,
          to: undefined,
        })
      }
    >
      {/* Market (required) */}
      {promptSetLoading ? (
        <SelectFilter
          options={[]}
          value=""
          onChange={() => {}}
          label={t('filters.promptSet')}
          placeholder={t('filters.promptSetPlaceholder')}
        />
      ) : (
        <SearchableSelectFilter
          options={promptSetOptions}
          value={filters.promptSetId ?? ''}
          onChange={(value) => onFiltersChange({ ...filters, promptSetId: value || '' })}
          label={t('filters.promptSet')}
          placeholder={t('filters.promptSetPlaceholder')}
        />
      )}

      {/* Brand (required) */}
      {brandsLoading ? (
        <SelectFilter
          options={[]}
          value=""
          onChange={() => {}}
          label={t('filters.brand')}
          placeholder={t('filters.brandPlaceholder')}
        />
      ) : (
        <SearchableSelectFilter
          options={brandOptions}
          value={filters.brandId ?? ''}
          onChange={(value) => onFiltersChange({ ...filters, brandId: value || '' })}
          label={t('filters.brand')}
          placeholder={t('filters.brandPlaceholder')}
        />
      )}

      {/* Platform (optional) */}
      {platformOptions.length > 0 && (
        <SearchableSelectFilter
          options={platformFilterOptions}
          value={filters.platformId ?? ''}
          onChange={(value) => onFiltersChange({ ...filters, platformId: value || undefined })}
          label={t('filters.platform')}
          placeholder={t('filters.platformAll')}
        />
      )}

      {/* Type */}
      <SelectFilter
        options={typeOptions}
        value={filters.type ?? '__all__'}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            type: (value === '__all__' ? undefined : value) as OpportunityViewFilters['type'],
          })
        }
        label={t('filters.type')}
      />

      {/* Min competitors */}
      <SelectFilter
        options={minCompetitorOptions}
        value={filters.minCompetitorCount ? String(filters.minCompetitorCount) : '__any__'}
        onChange={(value) =>
          onFiltersChange({
            ...filters,
            minCompetitorCount: value === '__any__' ? undefined : parseInt(value, 10),
          })
        }
        label={t('filters.minCompetitors')}
      />

      {/* Date range */}
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
