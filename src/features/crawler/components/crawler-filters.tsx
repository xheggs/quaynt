'use client';

import { useTranslations } from 'next-intl';

import { FilterBar } from '@/components/filters/filter-bar';
import { SearchableSelectFilter } from '@/components/filters/searchable-select-filter';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import type { AnalyticsFilters, BotCategory } from '../crawler.types';

interface CrawlerFiltersProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: Partial<AnalyticsFilters>) => void;
  botNames?: string[];
}

const CATEGORY_OPTIONS: Array<{ value: BotCategory; label: string }> = [
  { value: 'search', label: 'Search' },
  { value: 'training', label: 'Training' },
  { value: 'user_action', label: 'User Action' },
];

export function CrawlerFilters({ filters, onFiltersChange, botNames }: CrawlerFiltersProps) {
  const t = useTranslations('crawlerAnalytics');

  const activeCount = [filters.botName, filters.botCategory].filter(Boolean).length;

  const botOptions = (botNames ?? []).map((name) => ({ value: name, label: name }));

  return (
    <FilterBar
      activeCount={activeCount}
      onClearAll={() => onFiltersChange({ botName: undefined, botCategory: undefined })}
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
        label={t('filters.botName')}
        placeholder={t('filters.allBots')}
        options={botOptions}
        value={filters.botName ?? ''}
        onChange={(value) => onFiltersChange({ botName: value || undefined })}
      />
      <SearchableSelectFilter
        label={t('filters.botCategory')}
        placeholder={t('filters.allCategories')}
        options={CATEGORY_OPTIONS}
        value={filters.botCategory ?? ''}
        onChange={(value) => onFiltersChange({ botCategory: (value as BotCategory) || undefined })}
      />
    </FilterBar>
  );
}
