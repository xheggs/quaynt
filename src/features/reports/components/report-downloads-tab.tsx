'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { EmptyState } from '@/components/empty-state';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';

import type { ReportJob } from '../reports.types';
import { buildReportDownloadUrl } from '../reports.api';
import { useReportJobsQuery } from '../use-reports-query';
import { ReportFormatBadge } from './report-format-badge';
import { ReportJobStatusBadge } from './report-job-status-badge';

interface ReportDownloadsTabProps {
  onNavigateToGenerate: () => void;
}

export function ReportDownloadsTab({ onNavigateToGenerate }: ReportDownloadsTabProps) {
  const t = useTranslations('reports');
  const locale = useLocale();

  const { data, meta, isLoading, sorting, onSortingChange, pagination, onPaginationChange } =
    useReportJobsQuery({
      status: undefined,
    });

  const { showSkeleton } = useDelayedLoading(isLoading);

  const columns = useDownloadColumns({ locale, t });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-section">{t('downloads.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('downloads.description')}</p>
        </div>
        {meta.total > 0 && (
          <Badge variant="secondary">{t('downloads.count', { count: meta.total })}</Badge>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
        isLoading={showSkeleton}
        emptyState={
          <EmptyState
            icon={FileText}
            title={t('downloads.empty.title')}
            description={t('downloads.empty.description')}
            action={{
              label: t('downloads.empty.cta'),
              onClick: onNavigateToGenerate,
            }}
          />
        }
      />

      {meta.total > 0 && (
        <DataTablePagination
          page={meta.page}
          limit={meta.limit}
          total={meta.total}
          onPageChange={(page) =>
            onPaginationChange({ pageIndex: page - 1, pageSize: pagination.pageSize })
          }
          onLimitChange={(limit) => onPaginationChange({ pageIndex: 0, pageSize: limit })}
        />
      )}
    </div>
  );
}

function useDownloadColumns({
  locale,
  t,
}: {
  locale: string;
  t: ReturnType<typeof useTranslations<'reports'>>;
}): ColumnDef<ReportJob>[] {
  return useMemo(
    (): ColumnDef<ReportJob>[] => [
      {
        id: 'format',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('downloads.columns.format')}
          </span>
        ),
        cell: () => <ReportFormatBadge format="pdf" />,
        enableSorting: false,
      },
      {
        id: 'scope',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('downloads.columns.brands')}
          </span>
        ),
        cell: ({ row }) => {
          const job = row.original;
          return (
            <span className="text-sm">
              {job.brandIds.length > 0 && <Badge variant="secondary">{job.brandIds.length}</Badge>}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('downloads.columns.createdAt')} />
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return (
            <span className="type-caption text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(date)}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'expiresAt',
        accessorKey: 'expiresAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('downloads.columns.expiresAt')} />
        ),
        cell: ({ row }) => {
          const job = row.original;
          if (!job.expiresAt) return <span className="type-caption text-muted-foreground">—</span>;

          const expiry = new Date(job.expiresAt);
          const now = new Date();
          if (expiry <= now) {
            return <Badge variant="destructive">{t('downloads.expired')}</Badge>;
          }

          const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return (
            <span className="type-caption tabular-nums text-muted-foreground">
              {t('downloads.expiresIn', { days: diffDays })}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('downloads.columns.status')} />
        ),
        cell: ({ row }) => <ReportJobStatusBadge status={row.original.status} />,
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('downloads.columns.actions')}</span>,
        cell: ({ row }) => {
          const job = row.original;
          const isCompleted = job.status === 'completed';
          const isExpired = job.expiresAt && new Date(job.expiresAt) <= new Date();
          const canDownload = isCompleted && !isExpired;

          return (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" disabled={!canDownload} asChild={canDownload}>
                {canDownload ? (
                  <a
                    href={buildReportDownloadUrl(job.jobId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="size-4" />
                    {t('downloads.download')}
                  </a>
                ) : (
                  <span>
                    <Download className="size-4" />
                    {t('downloads.download')}
                  </span>
                )}
              </Button>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [locale, t]
  );
}
