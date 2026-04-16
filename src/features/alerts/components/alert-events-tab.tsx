'use client';

import { useCallback, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FilterBar } from '@/components/filters/filter-bar';
import { SelectFilter } from '@/components/filters/select-filter';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { TableSkeleton } from '@/components/skeletons';

import type { AlertEvent } from '../alerts.types';
import { ALERT_SEVERITIES, EVENT_STATUSES } from '../alerts.types';
import { acknowledgeEvent, fetchAlertRules } from '../alerts.api';
import { useAlertEventsQuery } from '../use-alerts-query';
import { useAlertEventColumns } from './alert-event-columns';

const SEVERITY_I18N: Record<string, string> = {
  info: 'info',
  warning: 'warning',
  critical: 'critical',
};

const STATUS_I18N: Record<string, string> = {
  active: 'active',
  acknowledged: 'acknowledged',
  snoozed: 'snoozed',
};

export function AlertEventsTab() {
  const t = useTranslations('alerts');
  const queryClient = useQueryClient();

  // Filters
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ruleFilter, setRuleFilter] = useState('');

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
  } = useAlertEventsQuery({
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
    alertRuleId: ruleFilter || undefined,
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  // Fetch rules for the rule filter dropdown
  const { data: rulesData } = useQuery({
    queryKey: queryKeys.alerts.list({ limit: 100 }),
    queryFn: () => fetchAlertRules({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  // Acknowledge mutation with optimistic update
  const acknowledgeMutation = useApiMutation<AlertEvent, string>({
    mutationFn: (id) => acknowledgeEvent(id),
    invalidateKeys: [queryKeys.alertEvents.lists()],
    successMessage: t('event.acknowledged'),
  });

  const onAcknowledge = useCallback(
    (event: AlertEvent) => {
      acknowledgeMutation.mutate(event.id);
    },
    [acknowledgeMutation]
  );

  const columns = useAlertEventColumns({ onAcknowledge });

  // Filter options
  const severityOptions = useMemo(
    () => [
      { value: '_all', label: t('rules.filterAll') },
      ...ALERT_SEVERITIES.map((s) => ({
        value: s,
        label: t(`severity.${SEVERITY_I18N[s]}` as never),
      })),
    ],
    [t]
  );

  const statusOptions = useMemo(
    () => [
      { value: '_all', label: t('rules.filterAll') },
      ...EVENT_STATUSES.map((s) => ({
        value: s,
        label: t(`management.status.${STATUS_I18N[s]}` as never),
      })),
    ],
    [t]
  );

  const ruleOptions = useMemo(
    () => [
      { value: '_all', label: t('rules.filterAll') },
      ...(rulesData?.data ?? []).map((r) => ({
        value: r.id,
        label: r.name,
      })),
    ],
    [t, rulesData]
  );

  const hasFilters = !!severityFilter || !!statusFilter || !!ruleFilter;
  const isEmpty = meta.total === 0 && !hasFilters && !isLoading;

  const handleClearAll = useCallback(() => {
    resetParams();
    setSeverityFilter('');
    setStatusFilter('');
    setRuleFilter('');
  }, [resetParams]);

  const activeFilterCount = [severityFilter, statusFilter, ruleFilter].filter(Boolean).length;

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
      <div className="flex items-baseline gap-3">
        <h2 className="type-section">{t('events.title')}</h2>
        {meta.total > 0 && (
          <span className="text-sm text-muted-foreground">
            {t('events.count', { count: meta.total })}
          </span>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Bell}
          title={t('events.empty.title')}
          description={t('events.empty.description')}
        />
      ) : (
        <>
          {/* Filters */}
          <FilterBar activeCount={activeFilterCount} onClearAll={handleClearAll}>
            <SelectFilter
              options={severityOptions}
              value={severityFilter || '_all'}
              onChange={(v) => setSeverityFilter(v === '_all' ? '' : v)}
              label={t('events.filterSeverity')}
            />
            <SelectFilter
              options={statusOptions}
              value={statusFilter || '_all'}
              onChange={(v) => setStatusFilter(v === '_all' ? '' : v)}
              label={t('events.filterStatus')}
            />
            <SelectFilter
              options={ruleOptions}
              value={ruleFilter || '_all'}
              onChange={(v) => setRuleFilter(v === '_all' ? '' : v)}
              label={t('events.filterRule')}
            />
          </FilterBar>

          {/* Table */}
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={7} rows={10} />
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
    </div>
  );
}
