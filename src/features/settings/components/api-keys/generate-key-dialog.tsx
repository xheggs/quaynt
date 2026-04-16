'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { SubmitButton } from '@/components/forms/submit-button';
import { FormErrorSummary } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';

import type { ApiKeyCreate, ApiKeyGenerated } from '../../integrations.types';
import { API_KEY_SCOPES } from '../../integrations.types';
import { generateApiKey } from '../../integrations.api';
import { apiKeyCreateSchema, type ApiKeyCreateFormValues } from '../../integrations.validation';

interface GenerateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateKeyDialog({ open, onOpenChange }: GenerateKeyDialogProps) {
  const t = useTranslations('settings');
  const [step, setStep] = useState<'form' | 'display'>('form');
  const [generatedKey, setGeneratedKey] = useState<ApiKeyGenerated | null>(null);
  const [copied, setCopied] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && step === 'display') {
      // Confirm before closing in display step
      const confirmed = window.confirm(t('apiKeys.generated.closeConfirm'));
      if (!confirmed) return;
    }
    if (!nextOpen) {
      // Reset state on close
      setStep('form');
      setGeneratedKey(null);
      setCopied(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {step === 'form' ? (
          <GenerateKeyForm
            onGenerated={(key) => {
              setGeneratedKey(key);
              setStep('display');
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('apiKeys.generated.title')}</DialogTitle>
            </DialogHeader>

            {/* Warning banner */}
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('apiKeys.generated.warning')}
              </p>
            </div>

            {/* Key display */}
            <div className="flex gap-2">
              <Input value={generatedKey?.key ?? ''} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (generatedKey?.key) {
                    navigator.clipboard.writeText(generatedKey.key);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </Button>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>
                {t('apiKeys.generated.close')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface GenerateKeyFormProps {
  onGenerated: (key: ApiKeyGenerated) => void;
}

function GenerateKeyForm({ onGenerated }: GenerateKeyFormProps) {
  const t = useTranslations('settings');
  const [unmappedErrors, setUnmappedErrors] = useState<{ message: string }[]>([]);

  const form = useForm<ApiKeyCreateFormValues>({
    resolver: zodResolver(apiKeyCreateSchema),
    defaultValues: {
      name: '',
      scope: 'read',
      expiresAt: '',
    },
  });

  const mutation = useApiMutation<ApiKeyGenerated, ApiKeyCreate>({
    mutationFn: (data) => generateApiKey(data),
    invalidateKeys: [queryKeys.apiKeys.lists()],
    form,
    onSuccess: (key) => onGenerated(key),
  });

  const isSubmitting = mutation.isPending;

  function onSubmit(data: ApiKeyCreateFormValues) {
    setUnmappedErrors([]);
    mutation.mutate({
      name: data.name,
      scope: data.scope,
      expiresAt: data.expiresAt || undefined,
    });
  }

  const SCOPE_I18N_MAP: Record<string, string> = {
    read: 'read',
    'read-write': 'readWrite',
    admin: 'admin',
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('apiKeys.form.title')}</DialogTitle>
        <DialogDescription>{t('apiKeys.description')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormErrorSummary errors={unmappedErrors} />

        {/* Name */}
        <FormField
          name="key-name"
          label={t('apiKeys.form.nameLabel')}
          error={
            form.formState.errors.name ? t(form.formState.errors.name.message! as never) : undefined
          }
          required
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              {...form.register('name')}
              placeholder={t('apiKeys.form.namePlaceholder')}
              disabled={isSubmitting}
            />
          )}
        </FormField>

        {/* Scope */}
        <FormField name="key-scope" label={t('apiKeys.form.scopeLabel')} required>
          {(fieldProps) => (
            <>
              <Select
                value={form.watch('scope')}
                onValueChange={(val) =>
                  form.setValue('scope', val as ApiKeyCreateFormValues['scope'])
                }
                disabled={isSubmitting}
              >
                <SelectTrigger {...fieldProps}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {API_KEY_SCOPES.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      <div>
                        <span>
                          {t(`apiKeys.form.scopeOptions.${SCOPE_I18N_MAP[scope]}` as never)}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t(`apiKeys.form.scopeDescriptions.${SCOPE_I18N_MAP[scope]}` as never)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('apiKeys.form.scopeHelp')}</p>
            </>
          )}
        </FormField>

        {/* Expiration */}
        <FormField name="key-expires" label={t('apiKeys.form.expiresLabel')}>
          {(fieldProps) => (
            <>
              <Input
                {...fieldProps}
                type="date"
                {...form.register('expiresAt')}
                min={new Date().toISOString().split('T')[0]}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">{t('apiKeys.form.expiresHelp')}</p>
            </>
          )}
        </FormField>

        <DialogFooter>
          <SubmitButton isSubmitting={isSubmitting}>{t('apiKeys.form.submit')}</SubmitButton>
        </DialogFooter>
      </form>
    </>
  );
}
