'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import type { AdapterConfig } from '../../integrations.types';
import { deleteAdapter } from '../../integrations.api';

interface DeleteAdapterDialogProps {
  adapter: AdapterConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAdapterDialog({ adapter, open, onOpenChange }: DeleteAdapterDialogProps) {
  const t = useTranslations('settings');

  const mutation = useApiMutation<void, string>({
    mutationFn: () => deleteAdapter(adapter!.id),
    invalidateKeys: [queryKeys.adapters.lists()],
    successMessage: t('adapters.deleteSuccess', { name: adapter?.displayName ?? '' }),
    onSuccess: () => onOpenChange(false),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('adapters.deleteTitle')}
      description={t('adapters.deleteConfirm', { name: adapter?.displayName ?? '' })}
      confirmLabel={t('adapters.deleteTitle')}
      onConfirm={() => mutation.mutate(adapter!.id)}
      variant="destructive"
      isLoading={mutation.isPending}
    />
  );
}
