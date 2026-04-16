'use client';

import { useCallback, useState } from 'react';
import { Palette, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { queryKeys } from '@/lib/query/keys';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { TableSkeleton } from '@/components/skeletons';

import type { ReportTemplate } from '../reports.types';
import { MAX_TEMPLATES_PER_WORKSPACE } from '../reports.types';
import { duplicateReportTemplate, fetchTemplatePreview } from '../reports.api';
import { useReportTemplatesQuery } from '../use-reports-query';
import { useTemplateColumns } from './template-columns';
import { TemplateFormDialog } from './template-form-dialog';
import { DeleteTemplateDialog } from './delete-template-dialog';

export function ReportTemplatesTab() {
  const t = useTranslations('reportsTemplates');

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ReportTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<ReportTemplate | null>(null);

  const {
    data,
    meta,
    isLoading,
    isError,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
    setParams,
  } = useReportTemplatesQuery();

  const { showSkeleton } = useDelayedLoading(isLoading);

  // Duplicate mutation
  const duplicateMutation = useApiMutation<ReportTemplate, string>({
    mutationFn: (id) => duplicateReportTemplate(id),
    invalidateKeys: [queryKeys.reportTemplates.lists()],
    successMessage: t('duplicate.success'),
  });

  const onEdit = useCallback((template: ReportTemplate) => setEditTemplate(template), []);

  const onDuplicate = useCallback(
    (template: ReportTemplate) => {
      duplicateMutation.mutate(template.id);
    },
    [duplicateMutation]
  );

  const onDelete = useCallback((template: ReportTemplate) => setDeleteTemplate(template), []);

  const onPreview = useCallback(
    async (template: ReportTemplate) => {
      try {
        const blob = await fetchTemplatePreview(template.id);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      } catch {
        toast.error(t('preview.error'));
      }
    },
    [t]
  );

  const columns = useTemplateColumns({
    onEdit,
    onDuplicate,
    onDelete,
    onPreview,
  });

  const isEmpty = meta.total === 0 && !isLoading;
  const atLimit = meta.total >= MAX_TEMPLATES_PER_WORKSPACE;

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
          <h2 className="type-section">{t('page.title')}</h2>
          {meta.total > 0 && <Badge variant="secondary">{t('count', { count: meta.total })}</Badge>}
        </div>
        <div className="flex items-center gap-3">
          {meta.total > 0 && (
            <span className="type-caption text-muted-foreground">
              {t('limit.indicator', {
                count: meta.total,
                max: MAX_TEMPLATES_PER_WORKSPACE,
              })}
            </span>
          )}
          {atLimit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- tabIndex needed for tooltip on disabled button (Radix UI pattern) */}
                <span tabIndex={0}>
                  <Button disabled>
                    <Plus className="size-4" />
                    {t('empty.action')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t('limit.reached', { max: MAX_TEMPLATES_PER_WORKSPACE })}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t('empty.action')}
            </Button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Palette}
          title={t('empty.title')}
          description={t('empty.description')}
          action={{
            label: t('empty.action'),
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <>
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={6} rows={10} />
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
      <TemplateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TemplateFormDialog
        template={editTemplate ?? undefined}
        open={!!editTemplate}
        onOpenChange={(open) => {
          if (!open) setEditTemplate(null);
        }}
      />
      <DeleteTemplateDialog
        template={deleteTemplate}
        open={!!deleteTemplate}
        onOpenChange={(open) => {
          if (!open) setDeleteTemplate(null);
        }}
      />
    </div>
  );
}
