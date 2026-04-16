'use client';

import { useCallback, useMemo, useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchFilter } from '@/components/filters/search-filter';
import { SelectFilter } from '@/components/filters/select-filter';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { TableSkeleton } from '@/components/skeletons';

import type { AlertRule, NameLookup } from '../alerts.types';
import { ALERT_METRICS } from '../alerts.types';
import { updateAlertRule } from '../alerts.api';
import { useAlertRulesQuery } from '../use-alerts-query';
import { useAlertRuleColumns } from './alert-rule-columns';
import { AlertRuleFormDialog } from './alert-rule-form-dialog';
import { DeleteRuleDialog } from './delete-rule-dialog';

import { fetchBrands } from '@/features/brands/brand.api';
import { fetchPromptSets } from '@/features/prompt-sets/prompt-set.api';

const METRIC_I18N_KEY: Record<string, string> = {
  recommendation_share: 'recommendationShare',
  citation_count: 'citationCount',
  sentiment_score: 'sentimentScore',
  position_average: 'positionAverage',
};

export function AlertRulesTab() {
  const t = useTranslations('alerts');

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<AlertRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<AlertRule | null>(null);

  // Filters
  const [metricFilter, setMetricFilter] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('');

  const {
    data,
    meta,
    isLoading,
    isError,
    params,
    setParams,
    resetParams,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
  } = useAlertRulesQuery({
    metric: metricFilter || undefined,
    enabled: enabledFilter || undefined,
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  // Name lookups for brands and prompt sets
  const { data: brandsData } = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100 }),
    queryFn: () => fetchBrands({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: promptSetsData } = useQuery({
    queryKey: queryKeys.promptSets.list({ limit: 100 }),
    queryFn: () => fetchPromptSets({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const brandNames: NameLookup = useMemo(() => {
    const lookup: NameLookup = {};
    for (const b of brandsData?.data ?? []) {
      lookup[b.id] = b.name;
    }
    return lookup;
  }, [brandsData]);

  const promptSetNames: NameLookup = useMemo(() => {
    const lookup: NameLookup = {};
    for (const p of promptSetsData?.data ?? []) {
      lookup[p.id] = p.name;
    }
    return lookup;
  }, [promptSetsData]);

  // Toggle enabled mutation
  const toggleMutation = useApiMutation<AlertRule, { id: string; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => updateAlertRule(id, { enabled }),
    invalidateKeys: [queryKeys.alerts.lists()],
    successMessage: undefined,
  });

  const onToggleEnabled = useCallback(
    (rule: AlertRule) => {
      const newEnabled = !rule.enabled;
      toggleMutation.mutate(
        { id: rule.id, enabled: newEnabled },
        {
          onSuccess: () => {
            // Toast handled by the toggle state change
          },
        }
      );
    },
    [toggleMutation]
  );

  const onEdit = useCallback((rule: AlertRule) => setEditRule(rule), []);
  const onDelete = useCallback((rule: AlertRule) => setDeleteRule(rule), []);

  const columns = useAlertRuleColumns({
    onEdit,
    onDelete,
    onToggleEnabled,
    brandNames,
    promptSetNames,
  });

  // Metric filter options
  const metricOptions = useMemo(
    () => [
      { value: '_all', label: t('rules.filterAll') },
      ...ALERT_METRICS.map((m) => ({
        value: m,
        label: t(`metric.${METRIC_I18N_KEY[m]}` as never),
      })),
    ],
    [t]
  );

  // Enabled filter options
  const enabledOptions = useMemo(
    () => [
      { value: '_all', label: t('rules.filterAll') },
      { value: 'true', label: t('rules.filterEnabledOnly') },
      { value: 'false', label: t('rules.filterDisabledOnly') },
    ],
    [t]
  );

  const hasFilters = !!params.search || !!metricFilter || !!enabledFilter;
  const isEmpty = meta.total === 0 && !hasFilters && !isLoading;

  const handleClearAll = useCallback(() => {
    resetParams();
    setMetricFilter('');
    setEnabledFilter('');
  }, [resetParams]);

  const activeFilterCount = [params.search, metricFilter, enabledFilter].filter(Boolean).length;

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState variant="section" onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="type-section">{t('rules.title')}</h2>
          {meta.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('rules.count', { count: meta.total })}
            </span>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('rules.create')}
        </Button>
      </div>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Bell}
          title={t('rules.empty.title')}
          description={t('rules.empty.description')}
          action={{
            label: t('rules.empty.cta'),
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <>
          {/* Filters */}
          <FilterBar activeCount={activeFilterCount} onClearAll={handleClearAll}>
            <SearchFilter
              value={params.search ?? ''}
              onChange={(search) => setParams({ search: search || null })}
              placeholder={t('rules.search')}
            />
            <SelectFilter
              options={metricOptions}
              value={metricFilter || '_all'}
              onChange={(v) => setMetricFilter(v === '_all' ? '' : v)}
              label={t('rules.filterMetric')}
            />
            <SelectFilter
              options={enabledOptions}
              value={enabledFilter || '_all'}
              onChange={(v) => setEnabledFilter(v === '_all' ? '' : v)}
              label={t('rules.filterEnabled')}
            />
          </FilterBar>

          {/* Table */}
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={8} rows={10} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data}
              pageCount={Math.ceil(meta.total / meta.limit)}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              sorting={sorting}
              onSortingChange={onSortingChange}
            />
          )}

          {/* Pagination */}
          {meta.total > 0 && (
            <DataTablePagination
              page={meta.page}
              limit={meta.limit}
              total={meta.total}
              onPageChange={(page) => setParams({ page })}
              onLimitChange={(limit) => setParams({ limit })}
            />
          )}
        </>
      )}

      {/* Dialogs */}
      <AlertRuleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        brandOptions={brandsData?.data ?? []}
        promptSetOptions={promptSetsData?.data ?? []}
      />
      <AlertRuleFormDialog
        rule={editRule ?? undefined}
        open={!!editRule}
        onOpenChange={(open) => {
          if (!open) setEditRule(null);
        }}
        brandOptions={brandsData?.data ?? []}
        promptSetOptions={promptSetsData?.data ?? []}
      />
      <DeleteRuleDialog
        rule={deleteRule}
        open={!!deleteRule}
        onOpenChange={(open) => {
          if (!open) setDeleteRule(null);
        }}
      />
    </div>
  );
}
