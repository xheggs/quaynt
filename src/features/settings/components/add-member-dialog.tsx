'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

import type { WorkspaceMember } from '../settings.types';
import { addMember } from '../settings.api';
import { addMemberSchema, type AddMemberFormValues } from '../settings.validation';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberDialog({ open, onOpenChange }: AddMemberDialogProps) {
  const t = useTranslations('settings');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t('members.addTitle')}</DialogTitle>
          <DialogDescription>{t('members.addDescription')}</DialogDescription>
        </DialogHeader>
        <AddMemberForm key={open ? 'open' : 'closed'} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

interface AddMemberFormProps {
  onOpenChange: (open: boolean) => void;
}

function AddMemberForm({ onOpenChange }: AddMemberFormProps) {
  const t = useTranslations('settings');
  const tUi = useTranslations('ui');

  const form = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  });

  const mutation = useApiMutation<WorkspaceMember, AddMemberFormValues>({
    mutationFn: (data) => addMember(data),
    invalidateKeys: [queryKeys.members.lists()],
    successMessage: t('members.addSuccess', { name: 'Member' }),
    form,
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const onSubmit = (data: AddMemberFormValues) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="member-email">{t('members.emailLabel')}</Label>
        <Input
          id="member-email"
          type="email"
          placeholder={t('members.emailPlaceholder')}
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">
            {t(form.formState.errors.email.message as never)}
          </p>
        )}
      </div>

      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <div className="space-y-2">
            <Label htmlFor="member-role">{t('members.roleLabel')}</Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div>
                    <span>{t('members.roleLabels.admin')}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t('members.roleDescriptions.admin')}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div>
                    <span>{t('members.roleLabels.member')}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t('members.roleDescriptions.member')}
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('members.roleHelp')}</p>
          </div>
        )}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {tUi('form.cancel')}
        </Button>
        <SubmitButton isSubmitting={mutation.isPending}>{t('members.addSubmit')}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
