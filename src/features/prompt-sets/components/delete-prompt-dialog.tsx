'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import { deletePrompt } from '../prompt-set.api';

interface DeletePromptDialogProps {
  promptSetId: string;
  promptId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeletePromptDialog({
  promptSetId,
  promptId,
  open,
  onOpenChange,
}: DeletePromptDialogProps) {
  const t = useTranslations('promptSets');
  const tUi = useTranslations('ui');

  const mutation = useApiMutation<void, string>({
    mutationFn: (id) => deletePrompt(promptSetId, id),
    invalidateKeys: [queryKeys.promptSets.detail(promptSetId)],
    successMessage: t('prompts.delete.success'),
    onSuccess: () => onOpenChange(false),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('prompts.delete.title')}
      description={t('prompts.delete.description')}
      confirmLabel={tUi('form.delete')}
      variant="destructive"
      isLoading={mutation.isPending}
      onConfirm={() => {
        if (promptId) {
          mutation.mutate(promptId);
        }
      }}
    />
  );
}
