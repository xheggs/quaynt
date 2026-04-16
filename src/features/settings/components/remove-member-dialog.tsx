'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import type { WorkspaceMember } from '../settings.types';
import { removeMember } from '../settings.api';

interface RemoveMemberDialogProps {
  member: WorkspaceMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveMemberDialog({ member, open, onOpenChange }: RemoveMemberDialogProps) {
  const t = useTranslations('settings');

  const mutation = useApiMutation<unknown, string>({
    mutationFn: (memberId) => removeMember(memberId),
    invalidateKeys: [queryKeys.members.lists()],
    successMessage: t('members.removeSuccess', { name: member?.userName ?? '' }),
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('members.removeTitle')}
      description={t('members.removeConfirm', { name: member?.userName ?? '' })}
      confirmLabel={t('members.removeButton')}
      variant="destructive"
      isLoading={mutation.isPending}
      onConfirm={() => {
        if (member) {
          mutation.mutate(member.id);
        }
      }}
    />
  );
}
