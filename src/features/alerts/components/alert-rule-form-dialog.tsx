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
import { Switch } from '@/components/ui/switch';
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

import type { AlertRule, AlertRuleCreate, AlertRuleUpdate } from '../alerts.types';
import {
  ALERT_METRICS,
  ALERT_CONDITIONS,
  ALERT_DIRECTIONS,
  ALERT_SEVERITIES,
} from '../alerts.types';
import { createAlertRule, updateAlertRule } from '../alerts.api';
import { alertRuleCreateSchema, type AlertRuleFormValues } from '../alerts.validation';

const METRIC_I18N_KEY: Record<string, string> = {
  recommendation_share: 'recommendationShare',
  citation_count: 'citationCount',
  sentiment_score: 'sentimentScore',
  position_average: 'positionAverage',
};

const CONDITION_I18N_KEY: Record<string, string> = {
  drops_below: 'dropsBelow',
  exceeds: 'exceeds',
  changes_by_percent: 'changesByPercent',
  changes_by_absolute: 'changesByAbsolute',
};

const DIRECTION_I18N_KEY: Record<string, string> = {
  any: 'any',
  increase: 'increase',
  decrease: 'decrease',
};

interface AlertRuleFormDialogProps {
  rule?: AlertRule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandOptions: Array<{ id: string; name: string }>;
  promptSetOptions: Array<{ id: string; name: string }>;
}

export function AlertRuleFormDialog({
  rule,
  open,
  onOpenChange,
  brandOptions,
  promptSetOptions,
}: AlertRuleFormDialogProps) {
  const t = useTranslations('alerts');
  const isEdit = !!rule;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
          <DialogDescription>{t('rules.description')}</DialogDescription>
        </DialogHeader>
        <AlertRuleForm
          key={isEdit ? rule.id : 'create'}
          rule={rule}
          onOpenChange={onOpenChange}
          brandOptions={brandOptions}
          promptSetOptions={promptSetOptions}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AlertRuleFormProps {
  rule?: AlertRule;
  onOpenChange: (open: boolean) => void;
  brandOptions: Array<{ id: string; name: string }>;
  promptSetOptions: Array<{ id: string; name: string }>;
}

function AlertRuleForm({ rule, onOpenChange, brandOptions, promptSetOptions }: AlertRuleFormProps) {
  const t = useTranslations('alerts');
  const tUi = useTranslations('ui');
  const isEdit = !!rule;
  const [unmappedErrors, setUnmappedErrors] = useState<{ message: string }[]>([]);

  const form = useForm<AlertRuleFormValues>({
    resolver: zodResolver(alertRuleCreateSchema),
    defaultValues: isEdit
      ? {
          name: rule.name,
          description: rule.description ?? '',
          metric: rule.metric,
          promptSetId: rule.promptSetId,
          scope: {
            brandId: rule.scope.brandId,
            platformId: rule.scope.platformId ?? '',
            locale: rule.scope.locale ?? '',
          },
          condition: rule.condition,
          threshold: Number(rule.threshold),
          direction: rule.direction,
          cooldownMinutes: rule.cooldownMinutes,
          severity: rule.severity,
          enabled: rule.enabled,
        }
      : {
          name: '',
          description: '',
          metric: 'recommendation_share',
          promptSetId: '',
          scope: { brandId: '', platformId: '', locale: '' },
          condition: 'drops_below',
          threshold: undefined as unknown as number,
          direction: 'any',
          cooldownMinutes: 60,
          severity: 'warning',
          enabled: true,
        },
  });

  const createMutation = useApiMutation<AlertRule, AlertRuleCreate>({
    mutationFn: (data) => createAlertRule(data),
    invalidateKeys: [queryKeys.alerts.lists()],
    successMessage: t('rule.created'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const updateMutation = useApiMutation<AlertRule, AlertRuleUpdate>({
    mutationFn: (data) => updateAlertRule(rule!.id, data),
    invalidateKeys: [queryKeys.alerts.lists(), ...(rule ? [queryKeys.alerts.detail(rule.id)] : [])],
    successMessage: t('rule.updated'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: AlertRuleFormValues) {
    setUnmappedErrors([]);
    // Clean optional empty strings
    const cleaned = {
      ...data,
      description: data.description || undefined,
      scope: {
        brandId: data.scope.brandId,
        platformId: data.scope.platformId || undefined,
        locale: data.scope.locale || undefined,
      },
    };
    if (isEdit) {
      updateMutation.mutate(cleaned);
    } else {
      createMutation.mutate(cleaned as AlertRuleCreate);
    }
  }

  // Watch values for conditional rendering
  const watchedCondition = form.watch('condition');
  const watchedMetric = form.watch('metric');
  const watchedThreshold = form.watch('threshold');

  const isChangeBased =
    watchedCondition === 'changes_by_percent' || watchedCondition === 'changes_by_absolute';

  // Sentence preview
  const metricLabel = METRIC_I18N_KEY[watchedMetric]
    ? t(`metric.${METRIC_I18N_KEY[watchedMetric]}` as never)
    : watchedMetric;
  const conditionLabel = CONDITION_I18N_KEY[watchedCondition]
    ? t(`condition.${CONDITION_I18N_KEY[watchedCondition]}` as never)
    : watchedCondition;
  const thresholdDisplay =
    watchedThreshold != null && !isNaN(watchedThreshold) ? String(watchedThreshold) : '…';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <FormErrorSummary errors={unmappedErrors} />

      {/* Section 1: Basics */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">{t('form.sectionBasics')}</legend>
        <FormField
          name="rule-name"
          label={t('form.name')}
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
          name="rule-description"
          label={t('form.description')}
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
              placeholder={t('form.descriptionPlaceholder')}
              disabled={isSubmitting}
              rows={2}
            />
          )}
        </FormField>
      </fieldset>

      {/* Section 2: What to monitor */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">
          {t('form.sectionMonitor')}
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FormField name="rule-metric" label={t('form.metric')} required>
              {(fieldProps) => (
                <Controller
                  control={form.control}
                  name="metric"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEdit || isSubmitting}
                    >
                      <SelectTrigger {...fieldProps}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERT_METRICS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {t(`metric.${METRIC_I18N_KEY[m]}` as never)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            {isEdit && (
              <p className="type-caption text-muted-foreground">{t('form.metricImmutable')}</p>
            )}
          </div>
          <div>
            <FormField
              name="rule-prompt-set"
              label={t('form.promptSet')}
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
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isEdit || isSubmitting}
                    >
                      <SelectTrigger {...fieldProps}>
                        <SelectValue placeholder={t('form.promptSet')} />
                      </SelectTrigger>
                      <SelectContent>
                        {promptSetOptions.map((ps) => (
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
            {isEdit && (
              <p className="type-caption text-muted-foreground">{t('form.promptSetImmutable')}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            name="rule-brand"
            label={t('form.brand')}
            error={
              form.formState.errors.scope?.brandId
                ? t(form.formState.errors.scope.brandId.message! as never)
                : undefined
            }
            required
          >
            {(fieldProps) => (
              <Controller
                control={form.control}
                name="scope.brandId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger {...fieldProps}>
                      <SelectValue placeholder={t('form.brand')} />
                    </SelectTrigger>
                    <SelectContent>
                      {brandOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField name="rule-locale" label={t('form.locale')}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                {...form.register('scope.locale')}
                placeholder={t('form.localePlaceholder')}
                disabled={isSubmitting}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      {/* Section 3: When to alert */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">
          {t('form.sectionCondition')}
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <FormField name="rule-condition" label={t('form.condition')} required>
            {(fieldProps) => (
              <Controller
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger {...fieldProps}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALERT_CONDITIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`condition.${CONDITION_I18N_KEY[c]}` as never)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField
            name="rule-threshold"
            label={
              watchedCondition === 'changes_by_percent'
                ? t('form.thresholdPercentage')
                : t('form.threshold')
            }
            error={
              form.formState.errors.threshold
                ? t(form.formState.errors.threshold.message! as never)
                : undefined
            }
            required
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                step="any"
                {...form.register('threshold', { valueAsNumber: true })}
                placeholder={t('form.thresholdPlaceholder')}
                disabled={isSubmitting}
                className="tabular-nums"
              />
            )}
          </FormField>
        </div>
        {isChangeBased && (
          <div>
            <FormField name="rule-direction" label={t('form.direction')}>
              {(fieldProps) => (
                <Controller
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger {...fieldProps} className="w-1/2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERT_DIRECTIONS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {t(`direction.${DIRECTION_I18N_KEY[d]}` as never)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <p className="type-caption text-muted-foreground">{t('form.directionHelp')}</p>
          </div>
        )}
        {/* Sentence preview */}
        <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {t('form.conditionSentence', {
              metric: metricLabel,
              condition: conditionLabel.toLowerCase(),
              threshold: thresholdDisplay,
            })}
          </p>
        </div>
      </fieldset>

      {/* Section 4: Settings */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">
          {t('form.sectionSettings')}
        </legend>
        <div className="space-y-1.5">
          <Label>{t('form.severity')}</Label>
          <Controller
            control={form.control}
            name="severity"
            render={({ field }) => (
              <div className="flex gap-3">
                {ALERT_SEVERITIES.map((s) => {
                  const colors: Record<string, string> = {
                    critical: 'bg-red-500',
                    warning: 'bg-amber-500',
                    info: 'bg-blue-500',
                  };
                  return (
                    <label
                      key={s}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="radio"
                        value={s}
                        checked={field.value === s}
                        onChange={() => field.onChange(s)}
                        disabled={isSubmitting}
                        className="sr-only"
                      />
                      <span className={`size-2 rounded-full ${colors[s]}`} />
                      <span className="text-sm">{t(`severity.${s}` as never)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FormField
              name="rule-cooldown"
              label={t('form.cooldown')}
              error={
                form.formState.errors.cooldownMinutes
                  ? t(form.formState.errors.cooldownMinutes.message! as never)
                  : undefined
              }
              required
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  {...form.register('cooldownMinutes', { valueAsNumber: true })}
                  disabled={isSubmitting}
                  className="tabular-nums"
                />
              )}
            </FormField>
            <p className="type-caption text-muted-foreground">{t('form.cooldownHelp')}</p>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Controller
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  id="rule-enabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            <Label htmlFor="rule-enabled">{t('form.enabledLabel')}</Label>
          </div>
        </div>
      </fieldset>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          {tUi('form.cancel')}
        </Button>
        <SubmitButton isSubmitting={isSubmitting}>{t('form.submit')}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
