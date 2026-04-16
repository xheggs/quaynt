'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import type { ReportSchedule } from '../reports.types';
import { deleteReportSchedule } from '../reports.api';

interface DeleteScheduleDialogProps {
  schedule: ReportSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteScheduleDialog({ schedule, open, onOpenChange }: DeleteScheduleDialogProps) {
  const t = useTranslations('reports');
  const tUi = useTranslations('ui');

  const mutation = useApiMutation<void, string>({
    mutationFn: (id) => deleteReportSchedule(id),
    invalidateKeys: [queryKeys.reportSchedules.lists()],
    successMessage: t('schedules.deleteSuccess'),
    onSuccess: () => onOpenChange(false),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('schedules.deleteTitle')}
      description={t('schedules.deleteConfirm', {
        name: schedule?.name ?? '',
      })}
      confirmLabel={tUi('form.delete')}
      variant="destructive"
      isLoading={mutation.isPending}
      onConfirm={() => {
        if (schedule) {
          mutation.mutate(schedule.id);
        }
      }}
    />
  );
}
