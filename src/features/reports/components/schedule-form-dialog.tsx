'use client';

import { useCallback } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { FormField } from '@/components/forms/form-field';
import { SearchableSelectFilter } from '@/components/filters/searchable-select-filter';
import { MultiSelectFilter } from '@/components/filters/multi-select-filter';
import { usePromptSetOptions } from '@/features/dashboard';
import { fetchBrands } from '@/features/brands/brand.api';

import type { ReportSchedule, ReportScheduleCreate, ReportScheduleUpdate } from '../reports.types';
import { CRON_PRESETS } from '../reports.types';
import { createReportSchedule, updateReportSchedule } from '../reports.api';
import { reportScheduleCreateSchema, type ReportScheduleFormValues } from '../reports.validation';
import { describeCron } from '../reports.utils';

interface ScheduleFormDialogProps {
  schedule?: ReportSchedule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleFormDialog({ schedule, open, onOpenChange }: ScheduleFormDialogProps) {
  const t = useTranslations('reports');
  const isEdit = !!schedule;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
          <DialogDescription>{t('schedules.description')}</DialogDescription>
        </DialogHeader>
        <ScheduleForm
          key={isEdit ? schedule.id : 'create'}
          schedule={schedule}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ScheduleFormProps {
  schedule?: ReportSchedule;
  onOpenChange: (open: boolean) => void;
}

function ScheduleForm({ schedule, onOpenChange }: ScheduleFormProps) {
  const t = useTranslations('reports');
  const isEdit = !!schedule;

  const { options: promptSetOptions } = usePromptSetOptions();

  const { data: brandsData } = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100 }),
    queryFn: () => fetchBrands({ limit: 100 }),
  });
  const brandOptions = (brandsData?.data ?? []).map((b) => ({
    label: b.name,
    value: b.id,
  }));

  const form = useForm<ReportScheduleFormValues>({
    resolver: zodResolver(reportScheduleCreateSchema),
    defaultValues: isEdit
      ? {
          name: schedule.name,
          description: schedule.description ?? '',
          promptSetId: schedule.promptSetId,
          brandIds: schedule.brandIds,
          schedule: schedule.schedule,
          recipients: schedule.recipients,
          format: 'pdf',
          templateId: schedule.templateId ?? '',
          enabled: schedule.enabled,
          sendIfEmpty: schedule.sendIfEmpty,
        }
      : {
          name: '',
          description: '',
          promptSetId: '',
          brandIds: [],
          schedule: '',
          recipients: [''],
          format: 'pdf',
          templateId: '',
          enabled: true,
          sendIfEmpty: false,
        },
  });

  const watchedSchedule = useWatch({ control: form.control, name: 'schedule' });
  const cronPreview = watchedSchedule ? describeCron(watchedSchedule) : '';

  const createMutation = useApiMutation<ReportSchedule, ReportScheduleCreate>({
    mutationFn: (data) => createReportSchedule(data),
    invalidateKeys: [queryKeys.reportSchedules.lists()],
    successMessage: t('form.createTitle'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const updateMutation = useApiMutation<ReportSchedule, ReportScheduleUpdate>({
    mutationFn: (data) => updateReportSchedule(schedule!.id, data),
    invalidateKeys: [
      queryKeys.reportSchedules.lists(),
      ...(schedule ? [queryKeys.reportSchedules.detail(schedule.id)] : []),
    ],
    successMessage: t('form.editTitle'),
    form,
    onSuccess: () => onOpenChange(false),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Manage recipients as a dynamic list
  const recipients = useWatch({ control: form.control, name: 'recipients' });

  const addRecipient = useCallback(() => {
    const current = form.getValues('recipients');
    form.setValue('recipients', [...current, '']);
  }, [form]);

  const removeRecipient = useCallback(
    (index: number) => {
      const current = form.getValues('recipients');
      form.setValue(
        'recipients',
        current.filter((_, i) => i !== index)
      );
    },
    [form]
  );

  function onSubmit(data: ReportScheduleFormValues) {
    const cleaned = {
      ...data,
      description: data.description || undefined,
      templateId: data.templateId || undefined,
      recipients: data.recipients.filter((r) => r.trim() !== ''),
    };

    if (isEdit) {
      updateMutation.mutate(cleaned);
    } else {
      createMutation.mutate(cleaned as ReportScheduleCreate);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Section 1: Basics */}
      <fieldset className="space-y-4">
        <FormField
          name="schedule-name"
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
        <FormField name="schedule-description" label={t('form.description')}>
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

      {/* Section 2: Report scope */}
      <fieldset className="space-y-4">
        <FormField
          name="schedule-prompt-set"
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
                <SearchableSelectFilter
                  {...fieldProps}
                  options={promptSetOptions}
                  value={field.value}
                  onChange={field.onChange}
                  label={t('form.promptSet')}
                  placeholder={t('generate.promptSetPlaceholder')}
                />
              )}
            />
          )}
        </FormField>
        <FormField
          name="schedule-brands"
          label={t('form.brands')}
          error={
            form.formState.errors.brandIds
              ? t(form.formState.errors.brandIds.message! as never)
              : undefined
          }
          required
        >
          {(fieldProps) => (
            <Controller
              control={form.control}
              name="brandIds"
              render={({ field }) => (
                <MultiSelectFilter
                  {...fieldProps}
                  options={brandOptions}
                  value={field.value}
                  onChange={field.onChange}
                  label={t('form.brands')}
                  placeholder={t('generate.brandsPlaceholder')}
                  maxSelections={25}
                />
              )}
            />
          )}
        </FormField>
      </fieldset>

      {/* Section 3: Schedule */}
      <fieldset className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="schedule-cron">{t('form.schedule')}</Label>
          <div className="flex flex-wrap gap-2">
            {CRON_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => form.setValue('schedule', preset.value)}
                disabled={isSubmitting}
              >
                {t(preset.labelKey as never)}
              </Button>
            ))}
          </div>
          <Input
            id="schedule-cron"
            {...form.register('schedule')}
            placeholder={t('form.scheduleCustom')}
            disabled={isSubmitting}
            aria-invalid={!!form.formState.errors.schedule}
            aria-describedby={form.formState.errors.schedule ? 'schedule-cron-error' : undefined}
          />
          {cronPreview && <p className="type-caption text-muted-foreground">{cronPreview}</p>}
          <p className="type-caption text-muted-foreground">{t('form.scheduleHelp')}</p>
          {form.formState.errors.schedule && (
            <p id="schedule-cron-error" className="text-xs text-destructive">
              {t(form.formState.errors.schedule.message! as never)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  id="schedule-enabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            <Label htmlFor="schedule-enabled">{t('form.enabled')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="sendIfEmpty"
              render={({ field }) => (
                <Switch
                  id="schedule-sendIfEmpty"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            <Label htmlFor="schedule-sendIfEmpty" className="text-sm">
              {t('form.sendIfEmpty')}
            </Label>
          </div>
        </div>
        <p className="type-caption text-muted-foreground">{t('form.sendIfEmptyHelp')}</p>
      </fieldset>

      {/* Section 4: Delivery */}
      <fieldset className="space-y-4">
        <p className="type-caption text-muted-foreground">{t('form.formatInfo')}</p>
        <div className="space-y-1.5">
          <Label>{t('form.recipients')}</Label>
          <div className="space-y-2">
            {recipients.map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  {...form.register(`recipients.${index}`)}
                  type="email"
                  placeholder={t('form.recipientPlaceholder')}
                  disabled={isSubmitting}
                  aria-invalid={!!form.formState.errors.recipients?.[index]}
                />
                {recipients.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => removeRecipient(index)}
                    disabled={isSubmitting}
                    aria-label={t('form.removeRecipient')}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {form.formState.errors.recipients && (
              <p className="text-xs text-destructive">
                {typeof form.formState.errors.recipients.message === 'string'
                  ? t(form.formState.errors.recipients.message as never)
                  : null}
              </p>
            )}
          </div>
          {recipients.length < 50 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRecipient}
              disabled={isSubmitting}
            >
              <Plus className="size-4" />
              {t('form.addRecipient')}
            </Button>
          )}
        </div>
      </fieldset>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          {t('form.cancel')}
        </Button>
        <SubmitButton isSubmitting={isSubmitting}>{t('form.submit')}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
