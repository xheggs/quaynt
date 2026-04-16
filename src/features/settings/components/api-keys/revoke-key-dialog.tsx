'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import type { ApiKeyInfo } from '../../integrations.types';
import { revokeApiKey } from '../../integrations.api';

interface RevokeKeyDialogProps {
  apiKey: ApiKeyInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevokeKeyDialog({ apiKey, open, onOpenChange }: RevokeKeyDialogProps) {
  const t = useTranslations('settings');

  const mutation = useApiMutation<void, string>({
    mutationFn: () => revokeApiKey(apiKey!.id),
    invalidateKeys: [queryKeys.apiKeys.lists()],
    successMessage: t('apiKeys.revokeSuccess', { name: apiKey?.name ?? '' }),
    onSuccess: () => onOpenChange(false),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('apiKeys.revokeTitle')}
      description={t('apiKeys.revokeConfirm', { name: apiKey?.name ?? '' })}
      confirmLabel={t('apiKeys.revokeTitle')}
      onConfirm={() => mutation.mutate(apiKey!.id)}
      variant="destructive"
      isLoading={mutation.isPending}
    />
  );
}
