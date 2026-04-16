'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
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
import { SubmitButton } from '@/components/forms/submit-button';
import { FormErrorSummary } from '@/components/forms/form-error-summary';
import { FormField } from '@/components/forms/form-field';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/error-state';

import type {
  AdapterConfig,
  AdapterCreate,
  AdapterUpdate,
  CredentialField,
  ConfigField,
} from '../../integrations.types';
import { createAdapter, updateAdapter } from '../../integrations.api';
import { usePlatformsQuery } from '../../use-integrations-query';
import { PlatformIcon } from './platform-icon';
import {
  adapterCreateSchema,
  buildCredentialSchema,
  buildConfigSchema,
} from '../../integrations.validation';

interface AdapterFormDialogProps {
  adapter?: AdapterConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdapterFormDialog({ adapter, open, onOpenChange }: AdapterFormDialogProps) {
  const t = useTranslations('settings');
  const mode = adapter ? 'edit' : 'create';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('adapters.form.createTitle') : t('adapters.form.editTitle')}
          </DialogTitle>
          <DialogDescription>{t('adapters.description')}</DialogDescription>
        </DialogHeader>
        <AdapterForm
          key={mode === 'edit' ? adapter?.id : 'create'}
          mode={mode}
          adapter={adapter ?? undefined}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AdapterFormProps {
  mode: 'create' | 'edit';
  adapter?: AdapterConfig;
  onOpenChange: (open: boolean) => void;
}

function AdapterForm({ mode, adapter, onOpenChange }: AdapterFormProps) {
  const t = useTranslations('settings');
  const tUi = useTranslations('ui');
  const [unmappedErrors, setUnmappedErrors] = useState<{ message: string }[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>(adapter?.platformId ?? '');

  const {
    data: platforms,
    isLoading: platformsLoading,
    isError: platformsError,
    refetch,
  } = usePlatformsQuery();

  const selectedPlatform = useMemo(
    () => platforms?.find((p) => p.platformId === selectedPlatformId),
    [platforms, selectedPlatformId]
  );

  const dynamicSchema = useMemo(() => {
    if (!selectedPlatform) return adapterCreateSchema;

    return adapterCreateSchema.extend({
      credentials: buildCredentialSchema(selectedPlatform.credentialSchema),
      config: buildConfigSchema(selectedPlatform.configSchema),
    });
  }, [selectedPlatform]);

  type DynamicFormValues = z.infer<typeof dynamicSchema>;

  const form = useForm<DynamicFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(dynamicSchema) as any,
    defaultValues: {
      platformId: adapter?.platformId ?? '',
      displayName: adapter?.displayName ?? '',
    } as DynamicFormValues,
  });

  const createMutation = useApiMutation<AdapterConfig, AdapterCreate>({
    mutationFn: (data) => createAdapter(data),
    invalidateKeys: [queryKeys.adapters.lists()],
    successMessage: t('adapters.createSuccess'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const updateMutation = useApiMutation<AdapterConfig, { id: string; input: AdapterUpdate }>({
    mutationFn: ({ id, input }) => updateAdapter(id, input),
    invalidateKeys: [
      queryKeys.adapters.lists(),
      ...(adapter ? [queryKeys.adapters.detail(adapter.id)] : []),
    ],
    successMessage: t('adapters.updateSuccess'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: z.infer<typeof dynamicSchema>) {
    setUnmappedErrors([]);
    if (mode === 'create') {
      createMutation.mutate({
        platformId: data.platformId,
        displayName: data.displayName,
        credentials: (data as Record<string, unknown>).credentials as Record<
          string,
          string | number
        >,
        config: (data as Record<string, unknown>).config as Record<string, unknown>,
      });
    } else {
      const input: AdapterUpdate = { displayName: data.displayName };
      const creds = (data as Record<string, unknown>).credentials as
        | Record<string, string | number>
        | undefined;
      if (creds && Object.values(creds).some((v) => v !== '' && v !== undefined)) {
        input.credentials = creds;
      }
      const config = (data as Record<string, unknown>).config as
        | Record<string, unknown>
        | undefined;
      if (config && Object.keys(config).length > 0) {
        input.config = config;
      }
      updateMutation.mutate({ id: adapter!.id, input });
    }
  }

  function handlePlatformChange(platformId: string) {
    setSelectedPlatformId(platformId);
    const platform = platforms?.find((p) => p.platformId === platformId);
    form.setValue('platformId', platformId);
    form.setValue('displayName', platform?.platformName ?? '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (form as any).setValue('credentials', {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (form as any).setValue('config', {});
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormErrorSummary errors={unmappedErrors} />

      {/* Platform selector */}
      <FormField
        name="adapter-platform"
        label={t('adapters.form.platformLabel')}
        error={
          form.formState.errors.platformId
            ? t(form.formState.errors.platformId.message! as never)
            : undefined
        }
        required
      >
        {(fieldProps) => (
          <>
            {platformsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : platformsError ? (
              <ErrorState variant="inline" onRetry={() => refetch()} />
            ) : (
              <Select
                value={selectedPlatformId}
                onValueChange={handlePlatformChange}
                disabled={mode === 'edit' || isSubmitting}
              >
                <SelectTrigger {...fieldProps}>
                  <SelectValue placeholder={t('adapters.form.platformPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {platforms?.map((platform) => (
                    <SelectItem key={platform.platformId} value={platform.platformId}>
                      <span className="flex items-center gap-2">
                        <PlatformIcon platform={platform.platformId} size={16} />
                        {t(`adapters.platformNames.${platform.platformId}` as never)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </FormField>

      {/* Display name */}
      <FormField
        name="adapter-display-name"
        label={t('adapters.form.displayNameLabel')}
        error={
          form.formState.errors.displayName
            ? t(form.formState.errors.displayName.message! as never)
            : undefined
        }
        required
      >
        {(fieldProps) => (
          <Input
            {...fieldProps}
            {...form.register('displayName')}
            placeholder={t('adapters.form.displayNamePlaceholder')}
            disabled={isSubmitting}
          />
        )}
      </FormField>

      {/* Dynamic credential fields */}
      {selectedPlatform && selectedPlatform.credentialSchema.length > 0 && (
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">{t('adapters.form.credentialsSection')}</Label>
            <p className="text-xs text-muted-foreground">
              {mode === 'edit'
                ? t('adapters.form.credentialUpdateHelp')
                : t('adapters.form.credentialHelp')}
            </p>
          </div>
          <div key={selectedPlatformId} className="space-y-3">
            {selectedPlatform.credentialSchema.map((field) => (
              <DynamicCredentialField
                key={field.key}
                field={field}
                form={form}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dynamic config fields */}
      {selectedPlatform && selectedPlatform.configSchema.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t('adapters.form.configSection')}</Label>
          <div key={`config-${selectedPlatformId}`} className="space-y-3">
            {selectedPlatform.configSchema.map((field) => (
              <DynamicConfigField
                key={field.key}
                field={field}
                form={form}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        </div>
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
        <SubmitButton isSubmitting={isSubmitting}>{t('adapters.form.submit')}</SubmitButton>
      </DialogFooter>
    </form>
  );
}

// ─── Dynamic Field Components ────────────────────────────────────────────────

interface DynamicCredentialFieldProps {
  field: CredentialField;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  isSubmitting: boolean;
}

function DynamicCredentialField({ field, form, isSubmitting }: DynamicCredentialFieldProps) {
  const t = useTranslations('settings');
  const [showPassword, setShowPassword] = useState(false);

  const fieldName = `credentials.${field.key}`;
  const error = form.formState.errors?.credentials?.[field.key];

  return (
    <FormField
      name={`cred-${field.key}`}
      label={field.description}
      error={error ? t(error.message as never) : undefined}
      required={field.required}
    >
      {(fieldProps) => (
        <div className="relative">
          <Input
            {...fieldProps}
            type={
              field.type === 'password' && !showPassword
                ? 'password'
                : field.type === 'number'
                  ? 'number'
                  : 'text'
            }
            {...form.register(fieldName)}
            disabled={isSubmitting}
          />
          {field.type === 'password' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          )}
        </div>
      )}
    </FormField>
  );
}

interface DynamicConfigFieldProps {
  field: ConfigField;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  isSubmitting: boolean;
}

function DynamicConfigField({ field, form, isSubmitting }: DynamicConfigFieldProps) {
  const t = useTranslations('settings');
  const fieldName = `config.${field.key}`;
  const error = form.formState.errors?.config?.[field.key];

  if (field.type === 'select' && field.options?.length) {
    return (
      <FormField
        name={`config-${field.key}`}
        label={field.description}
        error={error ? t(error.message as never) : undefined}
        required={field.required}
      >
        {(fieldProps) => (
          <Select
            value={form.watch(fieldName) ?? field.default?.toString() ?? ''}
            onValueChange={(val) => form.setValue(fieldName, val)}
            disabled={isSubmitting}
          >
            <SelectTrigger {...fieldProps}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options!.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
    );
  }

  return (
    <FormField
      name={`config-${field.key}`}
      label={field.description}
      error={error ? t(error.message as never) : undefined}
      required={field.required}
    >
      {(fieldProps) => (
        <Input
          {...fieldProps}
          type={field.type === 'number' ? 'number' : 'text'}
          {...form.register(fieldName)}
          min={field.min}
          max={field.max}
          defaultValue={field.default}
          disabled={isSubmitting}
        />
      )}
    </FormField>
  );
}
