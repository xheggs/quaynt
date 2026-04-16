'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FilterBar } from '@/components/filters/filter-bar';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { ModelRunResult, ModelRunResultStatus } from '../model-run.types';
import { fetchModelRunResults } from '../model-run.api';
import { formatDuration } from '../lib/format-duration';
import { RunStatusBadge } from './run-status-badge';
import { ResultDetail } from './result-detail';

interface ResultTableProps {
  runId: string;
}

const RESULT_STATUSES: ModelRunResultStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
];

export function ResultTable({ runId }: ResultTableProps) {
  const t = useTranslations('modelRuns');

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [adapterFilter, setAdapterFilter] = useState<string | null>(null);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const {
    data,
    meta,
    isLoading,
    setParams,
    resetParams,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
  } = usePaginatedQuery<ModelRunResult>({
    queryKey: (p) => [
      ...queryKeys.modelRuns.detail(runId),
      'results',
      { ...p, status: statusFilter, adapterConfigId: adapterFilter },
    ],
    queryFn: (p) =>
      fetchModelRunResults(runId, {
        ...p,
        status: statusFilter ?? undefined,
        adapterConfigId: adapterFilter ?? undefined,
      }),
    defaultSort: 'createdAt',
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  const columns = useMemo(
    (): ColumnDef<ModelRunResult>[] => [
      {
        id: 'expand',
        header: () => <span className="sr-only">{t('results.expandRow')}</span>,
        cell: ({ row }) => {
          const isExpanded = expandedRows.has(row.original.id);
          return (
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => toggleRow(row.original.id)}
              aria-label={isExpanded ? t('results.collapseRow') : t('results.expandRow')}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </Button>
          );
        },
        enableSorting: false,
      },
      {
        id: 'status',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('columns.status')}</span>
        ),
        cell: ({ row }) => (
          <RunStatusBadge status={row.original.status} size="sm" variant="result" />
        ),
        enableSorting: false,
      },
      {
        id: 'prompt',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('results.prompt')}</span>
        ),
        cell: ({ row }) => {
          const prompt = row.original.interpolatedPrompt;
          const truncated = prompt.length > 80 ? prompt.slice(0, 80) + '…' : prompt;
          return <span className="text-sm">{truncated}</span>;
        },
        enableSorting: false,
      },
      {
        id: 'platform',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('results.platform')}</span>
        ),
        cell: ({ row }) => <Badge variant="outline">{row.original.platformId}</Badge>,
        enableSorting: false,
      },
      {
        id: 'duration',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('results.duration')}</span>
        ),
        cell: ({ row }) => {
          const dur = formatDuration(row.original.startedAt, row.original.completedAt, t as never);
          return <span className="type-caption text-muted-foreground">{dur ?? '\u2014'}</span>;
        },
        enableSorting: false,
      },
    ],
    [t, expandedRows, toggleRow]
  );

  const activeFilterCount = (statusFilter ? 1 : 0) + (adapterFilter ? 1 : 0);

  const handleClearFilters = useCallback(() => {
    setStatusFilter(null);
    setAdapterFilter(null);
    resetParams();
  }, [resetParams]);

  if (showSkeleton) {
    return (
      <div className="rounded-md border border-border">
        <TableSkeleton columns={5} rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar activeCount={activeFilterCount} onClearAll={handleClearFilters}>
        <Select
          value={statusFilter ?? 'all'}
          onValueChange={(v) => setStatusFilter(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[140px]" aria-label={t('filters.status')}>
            <SelectValue placeholder={t('filters.allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            {RESULT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`resultStatus.${s}` as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={data}
        pageCount={Math.ceil(meta.total / meta.limit)}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
        emptyState={<EmptyState variant="inline" title={t('results.empty')} />}
      />

      {/* Expanded row details */}
      {data.map(
        (result) =>
          expandedRows.has(result.id) && (
            <div key={`detail-${result.id}`} className="rounded-md border border-border">
              <ResultDetail result={result} />
            </div>
          )
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
    </div>
  );
}
