'use client';

import { useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SubmitButton } from '@/components/forms/submit-button';
import { FormErrorSummary } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';

import type { Brand } from '../brand.types';
import { createBrand, updateBrand } from '../brand.api';
import { brandFormSchema, type BrandFormValues } from '../brand.validation';
import { AliasInput } from './alias-input';

interface BrandFormDialogProps {
  mode: 'create' | 'edit';
  brand?: Brand;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandFormDialog({ mode, brand, open, onOpenChange }: BrandFormDialogProps) {
  const t = useTranslations('brands');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('create.title') : t('edit.title')}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t('create.description') : t('edit.description')}
          </DialogDescription>
        </DialogHeader>
        {/* Key forces fresh form mount when brand changes */}
        <BrandForm
          key={mode === 'edit' ? brand?.id : 'create'}
          mode={mode}
          brand={brand}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

interface BrandFormProps {
  mode: 'create' | 'edit';
  brand?: Brand;
  onOpenChange: (open: boolean) => void;
}

function BrandForm({ mode, brand, onOpenChange }: BrandFormProps) {
  const t = useTranslations('brands');
  const tUi = useTranslations('ui');
  const [unmappedErrors, setUnmappedErrors] = useState<{ message: string }[]>([]);

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues:
      mode === 'edit' && brand
        ? {
            name: brand.name,
            domain: brand.domain ?? '',
            aliases: brand.aliases,
            description: brand.description ?? '',
          }
        : { name: '', domain: '', aliases: [], description: '' },
  });

  const createMutation = useApiMutation<Brand, BrandFormValues>({
    mutationFn: (data) => createBrand(data),
    invalidateKeys: [queryKeys.brands.lists()],
    successMessage: t('create.success'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const updateMutation = useApiMutation<Brand, BrandFormValues>({
    mutationFn: (data) => updateBrand(brand!.id, data),
    invalidateKeys: [
      queryKeys.brands.lists(),
      ...(brand ? [queryKeys.brands.detail(brand.id)] : []),
    ],
    successMessage: t('edit.success'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: BrandFormValues) {
    setUnmappedErrors([]);
    if (mode === 'create') {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  }

  const descriptionValue = useWatch({ control: form.control, name: 'description' }) ?? '';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormErrorSummary errors={unmappedErrors} />

      <FormField
        name="brand-name"
        label={t('fields.name')}
        error={
          form.formState.errors.name ? t(form.formState.errors.name.message! as never) : undefined
        }
        required
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...form.register('name')}
            placeholder={t('form.namePlaceholder')}
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <FormField
        name="brand-domain"
        label={t('fields.domain')}
        error={
          form.formState.errors.domain
            ? t(form.formState.errors.domain.message! as never)
            : undefined
        }
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...form.register('domain')}
            placeholder={t('form.domainPlaceholder')}
            disabled={isSubmitting}
          />
        )}
      </FormField>

      <FormField
        name="brand-aliases"
        label={t('fields.aliases')}
        error={
          form.formState.errors.aliases
            ? t(form.formState.errors.aliases.message! as never)
            : undefined
        }
      >
        {(fieldProps) => (
          <Controller
            control={form.control}
            name="aliases"
            render={({ field }) => (
              <AliasInput
                {...fieldProps}
                value={field.value}
                onChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
        )}
      </FormField>

      <FormField
        name="brand-description"
        label={t('fields.description')}
        error={
          form.formState.errors.description
            ? t(form.formState.errors.description.message! as never)
            : undefined
        }
      >
        {(fieldProps) => (
          <>
            <Textarea
              {...fieldProps}
              {...form.register('description')}
              disabled={isSubmitting}
              rows={3}
            />
            <div className="flex items-center justify-end">
              <span className="type-caption text-muted-foreground">
                {t('form.charCount', {
                  current: descriptionValue.length,
                  max: 1000,
                })}
              </span>
            </div>
          </>
        )}
      </FormField>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          {tUi('form.cancel')}
        </Button>
        <SubmitButton isSubmitting={isSubmitting}>
          {mode === 'create' ? t('create.button') : tUi('form.submit')}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
