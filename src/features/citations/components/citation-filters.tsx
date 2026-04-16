'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchFilter } from '@/components/filters/search-filter';
import { SearchableSelectFilter } from '@/components/filters/searchable-select-filter';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { fetchBrands } from '@/features/brands/brand.api';

const PLATFORM_IDS = [
  'chatgpt',
  'perplexity',
  'gemini',
  'claude',
  'copilot',
  'grok',
  'deepseek',
  'aio',
] as const;

const CITATION_TYPES = ['owned', 'earned'] as const;
const SENTIMENT_LABELS = ['positive', 'neutral', 'negative'] as const;

interface CitationFiltersProps {
  params: Record<string, unknown>;
  setParams: (params: Record<string, unknown>) => void;
  resetParams: () => void;
}

export function CitationFilters({ params, setParams, resetParams }: CitationFiltersProps) {
  const t = useTranslations('citations');

  // Fetch brands for the brand filter dropdown
  const { data: brandsData } = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100 }),
    queryFn: () => fetchBrands({ limit: 100 }),
  });

  const brandOptions = (brandsData?.data ?? []).map((brand) => ({
    label: brand.name,
    value: brand.id,
  }));

  const platformOptions = PLATFORM_IDS.map((id) => ({
    label: t(`platforms.${id}`),
    value: id,
  }));

  const typeOptions = CITATION_TYPES.map((type) => ({
    label: t(`types.${type}`),
    value: type,
  }));

  const sentimentOptions = SENTIMENT_LABELS.map((label) => ({
    label: t(`sentiment.${label}`),
    value: label,
  }));

  const activeCount = [
    params.search,
    params.brandId,
    params.platformId,
    params.citationType,
    params.sentiment,
    params.from || params.to,
  ].filter(Boolean).length;

  return (
    <FilterBar activeCount={activeCount} onClearAll={resetParams}>
      <SearchFilter
        value={(params.search as string) ?? ''}
        onChange={(search) => setParams({ search: search || null })}
        placeholder={t('filters.searchPlaceholder')}
      />
      <SearchableSelectFilter
        options={brandOptions}
        value={(params.brandId as string) ?? ''}
        onChange={(brandId) => setParams({ brandId: brandId || null })}
        label={t('filters.brand')}
        placeholder={t('filters.brandPlaceholder')}
      />
      <SearchableSelectFilter
        options={platformOptions}
        value={(params.platformId as string) ?? ''}
        onChange={(platformId) => setParams({ platformId: platformId || null })}
        label={t('filters.platform')}
        placeholder={t('filters.platformPlaceholder')}
      />
      <SearchableSelectFilter
        options={typeOptions}
        value={(params.citationType as string) ?? ''}
        onChange={(citationType) => setParams({ citationType: citationType || null })}
        label={t('filters.type')}
        placeholder={t('filters.typePlaceholder')}
      />
      <SearchableSelectFilter
        options={sentimentOptions}
        value={(params.sentiment as string) ?? ''}
        onChange={(sentiment) => setParams({ sentiment: sentiment || null })}
        label={t('filters.sentiment')}
        placeholder={t('filters.sentimentPlaceholder')}
      />
      <DateRangeFilter
        from={params.from ? new Date(params.from as string) : undefined}
        to={params.to ? new Date(params.to as string) : undefined}
        onChange={(range) =>
          setParams({
            from: range.from?.toISOString() ?? null,
            to: range.to?.toISOString() ?? null,
          })
        }
        label={t('filters.dateRange')}
      />
    </FilterBar>
  );
}
