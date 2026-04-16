'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import type { AlertRule } from '../alerts.types';
import { deleteAlertRule } from '../alerts.api';

interface DeleteRuleDialogProps {
  rule: AlertRule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteRuleDialog({ rule, open, onOpenChange }: DeleteRuleDialogProps) {
  const t = useTranslations('alerts');
  const tUi = useTranslations('ui');

  const mutation = useApiMutation<void, string>({
    mutationFn: (id) => deleteAlertRule(id),
    invalidateKeys: [queryKeys.alerts.lists()],
    successMessage: t('rule.deleted'),
    onSuccess: () => onOpenChange(false),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('rules.deleteTitle')}
      description={t('rules.deleteConfirm', { name: rule?.name ?? '' })}
      confirmLabel={tUi('form.delete')}
      variant="destructive"
      isLoading={mutation.isPending}
      onConfirm={() => {
        if (rule) {
          mutation.mutate(rule.id);
        }
      }}
    />
  );
}
