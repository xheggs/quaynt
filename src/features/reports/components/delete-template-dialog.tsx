'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import type { ReportTemplate } from '../reports.types';
import { deleteReportTemplate } from '../reports.api';

interface DeleteTemplateDialogProps {
  template: ReportTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteTemplateDialog({ template, open, onOpenChange }: DeleteTemplateDialogProps) {
  const t = useTranslations('reportsTemplates');
  const tUi = useTranslations('ui');

  const mutation = useApiMutation<void, string>({
    mutationFn: (id) => deleteReportTemplate(id),
    invalidateKeys: [queryKeys.reportTemplates.lists()],
    successMessage: t('delete.success'),
    onSuccess: () => onOpenChange(false),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('delete.title')}
      description={t('delete.confirm', {
        name: template?.name ?? '',
      })}
      confirmLabel={tUi('form.delete')}
      variant="destructive"
      isLoading={mutation.isPending}
      onConfirm={() => {
        if (template) {
          mutation.mutate(template.id);
        }
      }}
    />
  );
}
