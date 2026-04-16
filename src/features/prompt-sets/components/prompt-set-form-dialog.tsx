'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

import type { PromptSet } from '../prompt-set.types';
import { createPromptSet, updatePromptSet } from '../prompt-set.api';
import { promptSetFormSchema, type PromptSetFormValues } from '../prompt-set.validation';
import { TagInput } from './tag-input';

interface PromptSetFormDialogProps {
  mode: 'create' | 'edit';
  promptSet?: PromptSet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptSetFormDialog({
  mode,
  promptSet,
  open,
  onOpenChange,
}: PromptSetFormDialogProps) {
  const t = useTranslations('promptSets');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('create.title') : t('edit.title')}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t('create.description') : t('edit.description')}
          </DialogDescription>
        </DialogHeader>
        <PromptSetForm
          key={mode === 'edit' ? promptSet?.id : 'create'}
          mode={mode}
          promptSet={promptSet}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

interface PromptSetFormProps {
  mode: 'create' | 'edit';
  promptSet?: PromptSet;
  onOpenChange: (open: boolean) => void;
}

function PromptSetForm({ mode, promptSet, onOpenChange }: PromptSetFormProps) {
  const t = useTranslations('promptSets');
  const tUi = useTranslations('ui');
  const [unmappedErrors, setUnmappedErrors] = useState<{ message: string }[]>([]);

  const form = useForm<PromptSetFormValues>({
    resolver: zodResolver(promptSetFormSchema),
    defaultValues:
      mode === 'edit' && promptSet
        ? {
            name: promptSet.name,
            description: promptSet.description ?? '',
            tags: promptSet.tags,
          }
        : { name: '', description: '', tags: [] },
  });

  const createMutation = useApiMutation<PromptSet, PromptSetFormValues>({
    mutationFn: (data) => createPromptSet(data),
    invalidateKeys: [queryKeys.promptSets.lists()],
    successMessage: t('create.success'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const updateMutation = useApiMutation<PromptSet, PromptSetFormValues>({
    mutationFn: (data) => updatePromptSet(promptSet!.id, data),
    invalidateKeys: [
      queryKeys.promptSets.lists(),
      ...(promptSet ? [queryKeys.promptSets.detail(promptSet.id)] : []),
    ],
    successMessage: t('edit.success'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: PromptSetFormValues) {
    setUnmappedErrors([]);
    if (mode === 'create') {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  }

  const descriptionValue = form.watch('description') ?? '';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormErrorSummary errors={unmappedErrors} />

      {/* Name */}
      <FormField
        name="prompt-set-name"
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

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="prompt-set-description">{t('fields.description')}</Label>
        <Textarea
          id="prompt-set-description"
          {...form.register('description')}
          aria-invalid={!!form.formState.errors.description}
          aria-describedby={
            form.formState.errors.description ? 'prompt-set-description-error' : undefined
          }
          disabled={isSubmitting}
          rows={3}
        />
        <div className="flex items-center justify-between">
          {form.formState.errors.description ? (
            <p id="prompt-set-description-error" className="text-xs text-destructive">
              {t(form.formState.errors.description.message! as never)}
            </p>
          ) : (
            <span />
          )}
          <span className="type-caption text-muted-foreground">
            {t('form.charCount', {
              current: descriptionValue.length,
              max: 2000,
            })}
          </span>
        </div>
      </div>

      {/* Tags */}
      <FormField
        name="prompt-set-tags"
        label={t('fields.tags')}
        error={
          form.formState.errors.tags ? t(form.formState.errors.tags.message! as never) : undefined
        }
      >
        {(fieldProps) => (
          <Controller
            control={form.control}
            name="tags"
            render={({ field }) => (
              <TagInput
                {...fieldProps}
                value={field.value}
                onChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
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
