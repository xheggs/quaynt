'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/forms/submit-button';

import type { WorkspaceMember, WorkspaceRole } from '../settings.types';
import { updateMemberRole } from '../settings.api';

interface ChangeRoleDialogProps {
  member: WorkspaceMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeRoleDialog({ member, open, onOpenChange }: ChangeRoleDialogProps) {
  const t = useTranslations('settings');
  const tUi = useTranslations('ui');
  const [role, setRole] = useState<WorkspaceRole>(member?.role ?? 'member');

  const mutation = useApiMutation<unknown, { memberId: string; role: WorkspaceRole }>({
    mutationFn: (data) => updateMemberRole(data.memberId, { role: data.role }),
    invalidateKeys: [queryKeys.members.lists()],
    successMessage: t('members.changeRoleSuccess', { name: member?.userName ?? '' }),
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const handleConfirm = () => {
    if (member) {
      mutation.mutate({ memberId: member.id, role });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('members.changeRoleTitle')}</DialogTitle>
          <DialogDescription>
            {t('members.changeRoleDescription', { name: member?.userName ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="new-role">{t('members.roleLabel')}</Label>
          <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
            <SelectTrigger id="new-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">{t('members.roleLabels.owner')}</SelectItem>
              <SelectItem value="admin">{t('members.roleLabels.admin')}</SelectItem>
              <SelectItem value="member">{t('members.roleLabels.member')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tUi('form.cancel')}
          </Button>
          <SubmitButton isSubmitting={mutation.isPending} onClick={handleConfirm} type="button">
            {t('members.changeRoleConfirm')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
