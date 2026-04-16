'use client';

import { useCallback, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchFilter } from '@/components/filters/search-filter';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { TableSkeleton } from '@/components/skeletons';

import type { ReportSchedule } from '../reports.types';
import { updateReportSchedule, triggerReportSchedule } from '../reports.api';
import { useReportSchedulesQuery } from '../use-reports-query';
import { useScheduleColumns } from './schedule-columns';
import { ScheduleFormDialog } from './schedule-form-dialog';
import { DeleteScheduleDialog } from './delete-schedule-dialog';

export function ReportSchedulesTab() {
  const t = useTranslations('reports');

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ReportSchedule | null>(null);
  const [deleteSchedule, setDeleteSchedule] = useState<ReportSchedule | null>(null);

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
  } = useReportSchedulesQuery();

  const { showSkeleton } = useDelayedLoading(isLoading);

  // Name lookups for prompt sets
  // Toggle enabled mutation
  const toggleMutation = useApiMutation<ReportSchedule, { id: string; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => updateReportSchedule(id, { enabled }),
    invalidateKeys: [queryKeys.reportSchedules.lists()],
    successMessage: undefined,
  });

  const onToggleEnabled = useCallback(
    (schedule: ReportSchedule) => {
      toggleMutation.mutate({
        id: schedule.id,
        enabled: !schedule.enabled,
      });
    },
    [toggleMutation]
  );

  // Trigger mutation
  const triggerMutation = useApiMutation<void, string>({
    mutationFn: (id) => triggerReportSchedule(id),
    invalidateKeys: [queryKeys.reportSchedules.lists()],
    successMessage: t('schedules.triggerSuccess'),
  });

  const onTrigger = useCallback(
    (schedule: ReportSchedule) => {
      triggerMutation.mutate(schedule.id);
    },
    [triggerMutation]
  );

  const onEdit = useCallback((schedule: ReportSchedule) => setEditSchedule(schedule), []);
  const onDelete = useCallback((schedule: ReportSchedule) => setDeleteSchedule(schedule), []);

  const columns = useScheduleColumns({
    onEdit,
    onDelete,
    onToggleEnabled,
    onTrigger,
  });

  const hasFilters = !!params.search;
  const isEmpty = meta.total === 0 && !hasFilters && !isLoading;
  const activeFilterCount = params.search ? 1 : 0;

  const handleClearAll = useCallback(() => {
    resetParams();
  }, [resetParams]);

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
          <h2 className="type-section">{t('schedules.title')}</h2>
          {meta.total > 0 && <Badge variant="secondary">{meta.total}</Badge>}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('schedules.create')}
        </Button>
      </div>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Calendar}
          title={t('schedules.empty.title')}
          description={t('schedules.empty.description')}
          action={{
            label: t('schedules.empty.cta'),
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <>
          <FilterBar activeCount={activeFilterCount} onClearAll={handleClearAll}>
            <SearchFilter
              value={params.search ?? ''}
              onChange={(search) => setParams({ search: search || null })}
              placeholder={t('schedules.name')}
            />
          </FilterBar>

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
      <ScheduleFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ScheduleFormDialog
        schedule={editSchedule ?? undefined}
        open={!!editSchedule}
        onOpenChange={(open) => {
          if (!open) setEditSchedule(null);
        }}
      />
      <DeleteScheduleDialog
        schedule={deleteSchedule}
        open={!!deleteSchedule}
        onOpenChange={(open) => {
          if (!open) setDeleteSchedule(null);
        }}
      />
    </div>
  );
}
