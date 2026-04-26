'use client';

import { useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FormErrorSummary } from '@/components/forms/form-error-summary';

import type { Prompt } from '../prompt-set.types';
import { addPrompt } from '../prompt-set.api';
import { promptFormSchema, type PromptFormValues } from '../prompt-set.validation';
import { VariablePreview } from './variable-preview';

interface AddPromptFormProps {
  promptSetId: string;
}

export function AddPromptForm({ promptSetId }: AddPromptFormProps) {
  const t = useTranslations('promptSets');

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: { template: '' },
  });

  const mutation = useApiMutation<Prompt, PromptFormValues>({
    mutationFn: (data) => addPrompt(promptSetId, data),
    invalidateKeys: [queryKeys.promptSets.detail(promptSetId)],
    successMessage: t('prompts.add.success'),
    form,
    onSuccess: () => form.reset(),
  });

  const templateValue = useWatch({ control: form.control, name: 'template' });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        form.handleSubmit((data) => mutation.mutate(data))();
      }
    },
    [form, mutation]
  );

  const onSubmit = useCallback((data: PromptFormValues) => mutation.mutate(data), [mutation]);

  return (
    <Card className="border-dashed p-4">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Captures Escape key to cancel adding prompt */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" onKeyDown={handleKeyDown}>
        <FormErrorSummary
          errors={
            form.formState.errors.template
              ? [{ message: t(form.formState.errors.template.message! as never) }]
              : []
          }
        />
        <Textarea
          {...form.register('template')}
          placeholder={t('prompts.add.placeholder')}
          rows={3}
          disabled={mutation.isPending}
          aria-label={t('fields.template')}
        />

        {templateValue && (
          <div className="type-caption text-muted-foreground">
            <VariablePreview template={templateValue} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="type-caption text-muted-foreground">
            {t('form.charCount', {
              current: templateValue?.length ?? 0,
              max: 5000,
            })}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={
              mutation.isPending || !templateValue?.trim() || (templateValue?.length ?? 0) > 5000
            }
          >
            <Plus className="size-4" />
            {t('prompts.add.button')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
