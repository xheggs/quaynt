'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import type { PromptSet } from '../prompt-set.types';
import { deletePromptSet } from '../prompt-set.api';

interface DeletePromptSetDialogProps {
  promptSet: PromptSet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeletePromptSetDialog({
  promptSet,
  open,
  onOpenChange,
  onSuccess,
}: DeletePromptSetDialogProps) {
  const t = useTranslations('promptSets');
  const tUi = useTranslations('ui');

  const mutation = useApiMutation<void, string>({
    mutationFn: (id) => deletePromptSet(id),
    invalidateKeys: [queryKeys.promptSets.lists()],
    successMessage: t('delete.success'),
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('delete.title')}
      description={t('delete.description', { name: promptSet?.name ?? '' })}
      confirmLabel={tUi('form.delete')}
      variant="destructive"
      isLoading={mutation.isPending}
      onConfirm={() => {
        if (promptSet) {
          mutation.mutate(promptSet.id);
        }
      }}
    />
  );
}
