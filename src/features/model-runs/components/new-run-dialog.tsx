'use client';

import { useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { SubmitButton } from '@/components/forms/submit-button';
import { FormErrorSummary } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';

import type { ModelRun } from '../model-run.types';
import { SUPPORTED_LOCALES } from '../model-run.types';
import { fetchBrands } from '@/features/brands/brand.api';
import { fetchPromptSets } from '@/features/prompt-sets/prompt-set.api';
import { createModelRun, fetchAdapterConfigs } from '../model-run.api';
import { createModelRunFormSchema, type CreateModelRunFormValues } from '../model-run.validation';

interface NewRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (runId: string) => void;
}

export function NewRunDialog({ open, onOpenChange, onSuccess }: NewRunDialogProps) {
  const t = useTranslations('modelRuns');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>
        {open && <NewRunForm key="new-run" onOpenChange={onOpenChange} onSuccess={onSuccess} />}
      </DialogContent>
    </Dialog>
  );
}

interface NewRunFormProps {
  onOpenChange: (open: boolean) => void;
  onSuccess?: (runId: string) => void;
}

function NewRunForm({ onOpenChange, onSuccess }: NewRunFormProps) {
  const t = useTranslations('modelRuns');
  const tUi = useTranslations('ui');
  const [unmappedErrors, setUnmappedErrors] = useState<{ message: string }[]>([]);

  const form = useForm<CreateModelRunFormValues>({
    resolver: zodResolver(createModelRunFormSchema),
    defaultValues: {
      promptSetId: '',
      brandId: '',
      adapterConfigIds: [],
      locale: '',
      market: '',
    },
  });

  // Load data for selectors
  const { data: brandsData } = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100, sort: 'name', order: 'asc' }),
    queryFn: () => fetchBrands({ limit: 100, sort: 'name', order: 'asc' }),
  });

  const { data: promptSetsData } = useQuery({
    queryKey: queryKeys.promptSets.list({ limit: 100, sort: 'name', order: 'asc' }),
    queryFn: () => fetchPromptSets({ limit: 100, sort: 'name', order: 'asc' }),
  });

  const { data: adaptersData } = useQuery({
    queryKey: queryKeys.adapters.list({ limit: 50, sort: 'displayName', order: 'asc' }),
    queryFn: () => fetchAdapterConfigs({ limit: 50, sort: 'displayName', order: 'asc' }),
  });

  const brands = brandsData?.data ?? [];
  const promptSets = promptSetsData?.data ?? [];
  const adapters = adaptersData?.data ?? [];

  const mutation = useApiMutation<ModelRun, CreateModelRunFormValues>({
    mutationFn: (data) =>
      createModelRun({
        ...data,
        locale: data.locale || undefined,
        market: data.market || undefined,
      }),
    invalidateKeys: [queryKeys.modelRuns.lists()],
    successMessage: t('create.success'),
    form,
    onSuccess: (run) => {
      onOpenChange(false);
      form.reset();
      onSuccess?.(run.id);
    },
  });

  const isSubmitting = mutation.isPending;
  const selectedAdapters = useWatch({ control: form.control, name: 'adapterConfigIds' });

  function onSubmit(data: CreateModelRunFormValues) {
    setUnmappedErrors([]);
    mutation.mutate(data);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormErrorSummary errors={unmappedErrors} />

      {/* Brand */}
      <FormField
        name="run-brand"
        label={t('detail.brand')}
        error={
          form.formState.errors.brandId
            ? t(form.formState.errors.brandId.message! as never)
            : undefined
        }
        required
      >
        {(fieldProps) => (
          <Controller
            control={form.control}
            name="brandId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...fieldProps}>
                  <SelectValue placeholder={t('form.brandPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>

      {/* Prompt Set */}
      <FormField
        name="run-prompt-set"
        label={t('detail.promptSet')}
        error={
          form.formState.errors.promptSetId
            ? t(form.formState.errors.promptSetId.message! as never)
            : undefined
        }
        required
      >
        {(fieldProps) => (
          <Controller
            control={form.control}
            name="promptSetId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...fieldProps}>
                  <SelectValue placeholder={t('form.promptSetPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {promptSets.map((ps) => (
                    <SelectItem key={ps.id} value={ps.id}>
                      {ps.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>

      {/* AI Platforms (adapter configs) */}
      <FormField
        name="run-adapters"
        label={t('detail.adapters')}
        error={
          form.formState.errors.adapterConfigIds
            ? t(form.formState.errors.adapterConfigIds.message! as never)
            : undefined
        }
        required
      >
        {(fieldProps) => (
          <>
            <p className="text-xs text-muted-foreground">{t('form.adapterHelp')}</p>
            <Controller
              control={form.control}
              name="adapterConfigIds"
              render={({ field }) => (
                <div
                  role="group"
                  aria-labelledby={fieldProps.id}
                  aria-describedby={fieldProps['aria-describedby']}
                  className="max-h-[200px] space-y-2 overflow-y-auto rounded-md border border-border p-3"
                >
                  {adapters.map((adapter) => {
                    const isSelectable = adapter.enabled && adapter.credentialsSet;
                    const isChecked = field.value.includes(adapter.id);
                    return (
                      <label key={adapter.id} className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isChecked}
                          disabled={!isSelectable || isSubmitting}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, adapter.id]);
                            } else {
                              field.onChange(field.value.filter((id: string) => id !== adapter.id));
                            }
                          }}
                        />
                        <span
                          className={isSelectable ? 'text-sm' : 'text-sm text-muted-foreground'}
                        >
                          {adapter.displayName}
                        </span>
                        <Badge variant="outline" className="text-[0.5625rem]">
                          {adapter.platformId}
                        </Badge>
                      </label>
                    );
                  })}
                  {adapters.length === 0 && (
                    <p className="text-sm text-muted-foreground">{tUi('loading.default')}</p>
                  )}
                </div>
              )}
            />
          </>
        )}
      </FormField>

      {/* Locale */}
      <FormField name="run-locale" label={t('labels.locale')}>
        {(fieldProps) => (
          <Controller
            control={form.control}
            name="locale"
            render={({ field }) => (
              <Select
                value={field.value || '__all__'}
                onValueChange={(v) => field.onChange(v === '__all__' ? '' : v)}
              >
                <SelectTrigger {...fieldProps}>
                  <SelectValue placeholder={t('labels.localePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('labels.localeAll')}</SelectItem>
                  {SUPPORTED_LOCALES.map((group) => (
                    <SelectGroup key={group.labelKey}>
                      <SelectLabel>{t(group.labelKey as never)}</SelectLabel>
                      {group.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>

      {/* Market */}
      <FormField name="run-market" label={t('detail.market')}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...form.register('market')}
            placeholder={t('form.marketPlaceholder')}
            disabled={isSubmitting}
          />
        )}
      </FormField>

      {/* Summary */}
      {selectedAdapters.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('form.summary', { platforms: selectedAdapters.length })}
        </p>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          {tUi('form.cancel')}
        </Button>
        <SubmitButton isSubmitting={isSubmitting}>{t('create.submit')}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
