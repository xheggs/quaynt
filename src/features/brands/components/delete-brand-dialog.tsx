'use client';

import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';

import type { Brand } from '../brand.types';
import { deleteBrand } from '../brand.api';

interface DeleteBrandDialogProps {
  brand: Brand | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteBrandDialog({
  brand,
  open,
  onOpenChange,
  onSuccess,
}: DeleteBrandDialogProps) {
  const t = useTranslations('brands');
  const tUi = useTranslations('ui');

  const mutation = useApiMutation<void, string>({
    mutationFn: (id) => deleteBrand(id),
    invalidateKeys: [queryKeys.brands.lists()],
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
      description={t('delete.description', { name: brand?.name ?? '' })}
      confirmLabel={tUi('form.delete')}
      variant="destructive"
      isLoading={mutation.isPending}
      onConfirm={() => {
        if (brand) {
          mutation.mutate(brand.id);
        }
      }}
    />
  );
}
