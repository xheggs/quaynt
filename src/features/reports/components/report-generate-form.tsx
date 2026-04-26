'use client';

import { useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelectFilter } from '@/components/filters/searchable-select-filter';
import { MultiSelectFilter } from '@/components/filters/multi-select-filter';
import { SubmitButton } from '@/components/forms/submit-button';
import { usePromptSetOptions } from '@/features/dashboard';
import { fetchBrands } from '@/features/brands/brand.api';

import { isCommercial } from '@/lib/edition';

import type { ReportFormat } from '../reports.types';
import { REPORT_FORMATS, COMPARISON_PERIODS } from '../reports.types';
import { buildExportUrl } from '../reports.api';
import { reportGenerateSchema, type ReportGenerateFormValues } from '../reports.validation';
import { useGenerateReportMutation, useReportTemplatesQuery } from '../use-reports-query';

interface ReportGenerateFormProps {
  onJobCreated: (jobId: string) => void;
}

export function ReportGenerateForm({ onJobCreated }: ReportGenerateFormProps) {
  const t = useTranslations('reports');
  const tTemplates = useTranslations('reportsTemplates');
  const [isExporting, setIsExporting] = useState(false);
  const showTemplates = isCommercial();

  const { options: promptSetOptions } = usePromptSetOptions();

  const { data: templates } = useReportTemplatesQuery();

  const { data: brandsData } = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100 }),
    queryFn: () => fetchBrands({ limit: 100 }),
  });
  const brandOptions = (brandsData?.data ?? []).map((b) => ({
    label: b.name,
    value: b.id,
  }));

  const form = useForm<ReportGenerateFormValues>({
    resolver: zodResolver(reportGenerateSchema),
    defaultValues: {
      promptSetId: '',
      brandIds: [],
      format: 'pdf',
      templateId: '',
      comparisonPeriod: undefined,
      from: '',
      to: '',
      platformId: '',
      locale: '',
    },
  });

  const generateMutation = useGenerateReportMutation();
  const watchedFormat = useWatch({ control: form.control, name: 'format' }) as ReportFormat;
  const isPdf = watchedFormat === 'pdf';
  const isSubmitting = generateMutation.isPending || isExporting;

  function onSubmit(data: ReportGenerateFormValues) {
    const cleaned = {
      ...data,
      templateId: data.templateId || undefined,
      from: data.from || undefined,
      to: data.to || undefined,
      platformId: data.platformId || undefined,
      locale: data.locale || undefined,
    };

    if (isPdf) {
      generateMutation.mutate(cleaned, {
        onSuccess: (job) => onJobCreated(job.jobId),
      });
    } else {
      // CSV/JSON/JSONL — trigger immediate download
      setIsExporting(true);
      const url = buildExportUrl({
        type: 'report',
        format: watchedFormat as 'csv' | 'json' | 'jsonl',
        promptSetId: data.promptSetId,
        brandIds: data.brandIds.join(','),
        ...(data.from ? { from: data.from } : {}),
        ...(data.to ? { to: data.to } : {}),
        ...(data.platformId ? { platformId: data.platformId } : {}),
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => setIsExporting(false), 1000);
    }
  }

  const submitLabel = isPdf
    ? t('generate.submitPdf')
    : t('generate.submitExport', { format: watchedFormat.toUpperCase() });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Section 1: Scope */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">{t('generate.title')}</legend>
        <p className="text-xs text-muted-foreground">{t('generate.description')}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('generate.promptSet')}</Label>
            <Controller
              control={form.control}
              name="promptSetId"
              render={({ field }) => (
                <SearchableSelectFilter
                  options={promptSetOptions}
                  value={field.value}
                  onChange={field.onChange}
                  label={t('generate.promptSet')}
                  placeholder={t('generate.promptSetPlaceholder')}
                />
              )}
            />
            {form.formState.errors.promptSetId && (
              <p className="text-xs text-destructive">
                {t(form.formState.errors.promptSetId.message! as never)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t('generate.platform')}</Label>
            <Input
              {...form.register('platformId')}
              placeholder={t('generate.platform')}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('generate.brands')}</Label>
          <Controller
            control={form.control}
            name="brandIds"
            render={({ field }) => (
              <MultiSelectFilter
                options={brandOptions}
                value={field.value}
                onChange={field.onChange}
                label={t('generate.brands')}
                placeholder={t('generate.brandsPlaceholder')}
                maxSelections={25}
              />
            )}
          />
          <p className="type-caption text-muted-foreground">
            {t('generate.brandsHelp', { max: 25 })}
          </p>
          {form.formState.errors.brandIds && (
            <p className="text-xs text-destructive">
              {t(form.formState.errors.brandIds.message! as never)}
            </p>
          )}
        </div>
      </fieldset>

      {/* Section 2: Time range */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">{t('generate.dateRange')}</legend>
        <p className="type-caption text-muted-foreground">{t('generate.dateRangeHelp')}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="report-from">{t('generate.dateRange')}</Label>
            <div className="flex gap-2">
              <Input
                id="report-from"
                type="date"
                {...form.register('from')}
                disabled={isSubmitting}
              />
              <Input
                id="report-to"
                type="date"
                {...form.register('to')}
                disabled={isSubmitting}
                aria-label="To date"
              />
            </div>
            {form.formState.errors.to && (
              <p className="text-xs text-destructive">
                {t(form.formState.errors.to.message! as never)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comparison-period">{t('generate.comparison')}</Label>
            <Controller
              control={form.control}
              name="comparisonPeriod"
              render={({ field }) => (
                <Select
                  value={field.value ?? 'none'}
                  onValueChange={(v) => field.onChange(v === 'none' ? undefined : v)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger aria-label={t('generate.comparison')}>
                    <SelectValue placeholder={t('generate.comparisonOptions.none')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('generate.comparisonOptions.none')}</SelectItem>
                    {COMPARISON_PERIODS.map((cp) => (
                      <SelectItem key={cp} value={cp}>
                        {t(`generate.comparisonOptions.${cp}` as never)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </fieldset>

      {/* Template selector (PDF + Commercial only) */}
      {isPdf && showTemplates && templates.length > 0 && (
        <fieldset className="space-y-4">
          <div className="space-y-1.5">
            <Label>{tTemplates('templateSelector')}</Label>
            <Controller
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <Select
                  value={field.value || 'default'}
                  onValueChange={(v) => field.onChange(v === 'default' ? '' : v)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tTemplates('templateSelectorPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      {tTemplates('templateSelectorPlaceholder')}
                    </SelectItem>
                    {templates.map((tmpl) => (
                      <SelectItem key={tmpl.id} value={tmpl.id}>
                        {tmpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="type-caption text-muted-foreground">
              {tTemplates('templateSelectorHint')}
            </p>
          </div>
        </fieldset>
      )}

      {/* Section 3: Output */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">{t('generate.format')}</legend>

        <Controller
          control={form.control}
          name="format"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {REPORT_FORMATS.map((fmt) => (
                <label
                  key={fmt}
                  className="flex cursor-pointer flex-col gap-1 rounded-md border border-border px-3 py-2 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    value={fmt}
                    checked={field.value === fmt}
                    onChange={() => field.onChange(fmt)}
                    disabled={isSubmitting}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">
                    {t(`generate.formatOptions.${fmt}` as never)}
                  </span>
                  <span className="type-caption text-muted-foreground">
                    {t(`generate.formatDescriptions.${fmt}` as never)}
                  </span>
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton isSubmitting={isSubmitting}>
          {isExporting && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
