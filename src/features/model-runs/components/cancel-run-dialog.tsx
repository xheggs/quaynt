'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import { cancelModelRun } from '../model-run.api';

interface CancelRunDialogProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelRunDialog({ runId, open, onOpenChange }: CancelRunDialogProps) {
  const t = useTranslations('modelRuns');

  const mutation = useApiMutation<unknown, string>({
    mutationFn: (id) => cancelModelRun(id),
    invalidateKeys: [
      queryKeys.modelRuns.lists(),
      ...(runId ? [queryKeys.modelRuns.detail(runId)] : []),
    ],
    successMessage: t('cancel.success'),
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('cancel.title')}
      description={t('cancel.description')}
      confirmLabel={t('cancel.confirm')}
      variant="destructive"
      isLoading={mutation.isPending}
      onConfirm={() => {
        if (runId) {
          mutation.mutate(runId);
        }
      }}
    />
  );
}
