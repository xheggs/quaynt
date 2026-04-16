'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check, Copy } from 'lucide-react';
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

import type { WebhookEndpoint, WebhookCreate, WebhookUpdate } from '../../integrations.types';
import { createWebhook, updateWebhook } from '../../integrations.api';
import { webhookCreateSchema, type WebhookCreateFormValues } from '../../integrations.validation';
import { WebhookEventSelect } from './webhook-event-select';

interface WebhookFormDialogProps {
  webhook?: WebhookEndpoint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebhookFormDialog({ webhook, open, onOpenChange }: WebhookFormDialogProps) {
  const t = useTranslations('settings');
  const mode = webhook ? 'edit' : 'create';
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setCreatedSecret(null);
      setCopied(false);
    }
    onOpenChange(nextOpen);
  }

  if (createdSecret) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('webhooks.secret.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('webhooks.secret.info')}
            </p>
          </div>

          <div className="flex gap-2">
            <Input value={createdSecret} readOnly className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(createdSecret);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>{t('webhooks.secret.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('webhooks.form.createTitle') : t('webhooks.form.editTitle')}
          </DialogTitle>
          <DialogDescription>{t('webhooks.description')}</DialogDescription>
        </DialogHeader>
        <WebhookForm
          key={mode === 'edit' ? webhook?.id : 'create'}
          mode={mode}
          webhook={webhook ?? undefined}
          onOpenChange={handleOpenChange}
          onCreatedSecret={setCreatedSecret}
        />
      </DialogContent>
    </Dialog>
  );
}

interface WebhookFormProps {
  mode: 'create' | 'edit';
  webhook?: WebhookEndpoint;
  onOpenChange: (open: boolean) => void;
  onCreatedSecret: (secret: string) => void;
}

function WebhookForm({ mode, webhook, onOpenChange, onCreatedSecret }: WebhookFormProps) {
  const t = useTranslations('settings');
  const tUi = useTranslations('ui');
  const [unmappedErrors, setUnmappedErrors] = useState<{ message: string }[]>([]);

  const form = useForm<WebhookCreateFormValues>({
    resolver: zodResolver(webhookCreateSchema),
    defaultValues: {
      url: webhook?.url ?? '',
      events: webhook?.events ?? [],
      description: webhook?.description ?? '',
    },
  });

  const createMutation = useApiMutation<WebhookEndpoint & { secret: string }, WebhookCreate>({
    mutationFn: (data) => createWebhook(data),
    invalidateKeys: [queryKeys.webhooks.lists()],
    successMessage: t('webhooks.createSuccess'),
    form,
    onSuccess: (data) => {
      onCreatedSecret(data.secret);
    },
  });

  const updateMutation = useApiMutation<WebhookEndpoint, { id: string; input: WebhookUpdate }>({
    mutationFn: ({ id, input }) => updateWebhook(id, input),
    invalidateKeys: [queryKeys.webhooks.lists()],
    successMessage: t('webhooks.updateSuccess'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: WebhookCreateFormValues) {
    setUnmappedErrors([]);
    if (mode === 'create') {
      createMutation.mutate({
        url: data.url,
        events: data.events,
        description: data.description || undefined,
      });
    } else {
      updateMutation.mutate({
        id: webhook!.id,
        input: {
          url: data.url,
          events: data.events,
          description: data.description || null,
        },
      });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormErrorSummary errors={unmappedErrors} />

      {/* URL */}
      <FormField
        name="webhook-url"
        label={t('webhooks.form.urlLabel')}
        error={
          form.formState.errors.url ? t(form.formState.errors.url.message! as never) : undefined
        }
        required
      >
        {(fieldProps) => (
          <>
            <Input
              {...fieldProps}
              {...form.register('url')}
              placeholder={t('webhooks.form.urlPlaceholder')}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">{t('webhooks.form.urlHelp')}</p>
          </>
        )}
      </FormField>

      {/* Events */}
      <FormField
        name="webhook-events"
        label={t('webhooks.form.eventsLabel')}
        error={
          form.formState.errors.events
            ? t(form.formState.errors.events.message! as never)
            : undefined
        }
        required
      >
        {(fieldProps) => (
          <>
            <Controller
              control={form.control}
              name="events"
              render={({ field }) => (
                <WebhookEventSelect {...fieldProps} value={field.value} onChange={field.onChange} />
              )}
            />
            <p className="text-xs text-muted-foreground">{t('webhooks.form.eventsHelp')}</p>
          </>
        )}
      </FormField>

      {/* Description */}
      <FormField
        name="webhook-description"
        label={t('webhooks.form.descriptionLabel')}
        error={
          form.formState.errors.description
            ? t(form.formState.errors.description.message! as never)
            : undefined
        }
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            {...form.register('description')}
            placeholder={t('webhooks.form.descriptionPlaceholder')}
            disabled={isSubmitting}
            rows={2}
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
        <SubmitButton isSubmitting={isSubmitting}>{t('webhooks.form.submit')}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
