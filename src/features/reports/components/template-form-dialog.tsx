'use client';

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

import type {
  ReportTemplate,
  ReportTemplateCreate,
  ReportTemplateUpdate,
  TemplateSections,
  FontFamily,
} from '../reports.types';
import { REPORT_SECTIONS, FONT_FAMILIES, DEFAULT_COLORS } from '../reports.types';
import { createReportTemplate, updateReportTemplate, deleteTemplateLogo } from '../reports.api';
import { reportTemplateCreateSchema, type ReportTemplateFormValues } from '../reports.validation';
import { TemplateLogoUpload } from './template-logo-upload';
import { TemplateColorInput } from './template-color-input';
import { TemplateSectionEditor } from './template-section-editor';

interface TemplateFormDialogProps {
  template?: ReportTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateFormDialog({ template, open, onOpenChange }: TemplateFormDialogProps) {
  const isEdit = !!template;
  const t = useTranslations('reportsTemplates');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogDescription>
        </DialogHeader>
        <TemplateFormContent
          key={isEdit ? template.id : 'create'}
          template={template}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function buildDefaultSections(): TemplateSections {
  const sections = {} as TemplateSections;
  for (const s of REPORT_SECTIONS) {
    sections[s] = true;
  }
  sections.sectionOrder = [...REPORT_SECTIONS];
  return sections;
}

interface TemplateFormContentProps {
  template?: ReportTemplate;
  onOpenChange: (open: boolean) => void;
}

function TemplateFormContent({ template, onOpenChange }: TemplateFormContentProps) {
  const t = useTranslations('reportsTemplates');
  const isEdit = !!template;
  const [unmappedError, setUnmappedError] = useState<string | null>(null);
  const [logoUploadId, setLogoUploadId] = useState<string | undefined>(undefined);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | undefined>(
    template?.branding.logoUrl
  );

  const [sections, setSections] = useState<TemplateSections>(
    template?.sections ?? buildDefaultSections()
  );

  const [primaryColor, setPrimaryColor] = useState(
    template?.branding.primaryColor ?? DEFAULT_COLORS.primaryColor
  );
  const [secondaryColor, setSecondaryColor] = useState(
    template?.branding.secondaryColor ?? DEFAULT_COLORS.secondaryColor
  );
  const [accentColor, setAccentColor] = useState(
    template?.branding.accentColor ?? DEFAULT_COLORS.accentColor
  );
  const [fontFamily, setFontFamily] = useState<FontFamily>(
    template?.branding.fontFamily ?? 'noto-sans'
  );

  const form = useForm<ReportTemplateFormValues>({
    resolver: zodResolver(reportTemplateCreateSchema),
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
      branding: {
        primaryColor: template?.branding.primaryColor ?? DEFAULT_COLORS.primaryColor,
        secondaryColor: template?.branding.secondaryColor ?? DEFAULT_COLORS.secondaryColor,
        accentColor: template?.branding.accentColor ?? DEFAULT_COLORS.accentColor,
        fontFamily: template?.branding.fontFamily ?? 'noto-sans',
        footerText: template?.branding.footerText ?? '',
      },
      coverOverrides: {
        title: template?.coverOverrides.title ?? '',
        subtitle: template?.coverOverrides.subtitle ?? '',
      },
    },
  });

  const createMutation = useApiMutation<ReportTemplate, ReportTemplateCreate>({
    mutationFn: (input) => createReportTemplate(input),
    invalidateKeys: [queryKeys.reportTemplates.lists()],
    successMessage: t('createSuccess'),
    onSuccess: () => onOpenChange(false),
    form,
  });

  const updateMutation = useApiMutation<
    ReportTemplate,
    { id: string; input: ReportTemplateUpdate }
  >({
    mutationFn: ({ id, input }) => updateReportTemplate(id, input),
    invalidateKeys: [
      queryKeys.reportTemplates.lists(),
      ...(template ? [queryKeys.reportTemplates.detail(template.id)] : []),
    ],
    successMessage: t('updateSuccess'),
    onSuccess: () => onOpenChange(false),
    form,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleLogoUploaded = useCallback((uploadId: string) => {
    setLogoUploadId(uploadId);
    setLogoRemoved(false);
  }, []);

  const handleLogoRemoved = useCallback(() => {
    setCurrentLogoUrl(undefined);
    setLogoUploadId(undefined);
    setLogoRemoved(true);
  }, []);

  const onSubmit = useCallback(
    async (values: ReportTemplateFormValues) => {
      setUnmappedError(null);

      const branding = {
        primaryColor,
        secondaryColor,
        accentColor,
        fontFamily,
        footerText: values.branding?.footerText || undefined,
        ...(logoUploadId ? { logoUploadId } : {}),
      };

      const payload = {
        name: values.name,
        description: values.description || undefined,
        branding,
        sections,
        coverOverrides: {
          title: values.coverOverrides?.title || undefined,
          subtitle: values.coverOverrides?.subtitle || undefined,
        },
      };

      try {
        if (isEdit && template) {
          // Delete logo if removed
          if (logoRemoved && template.branding.logoUrl) {
            await deleteTemplateLogo(template.id);
          }
          updateMutation.mutate({ id: template.id, input: payload });
        } else {
          createMutation.mutate(payload);
        }
      } catch {
        setUnmappedError(t('errors.uploadFailed'));
      }
    },
    [
      isEdit,
      template,
      primaryColor,
      secondaryColor,
      accentColor,
      fontFamily,
      logoUploadId,
      logoRemoved,
      sections,
      createMutation,
      updateMutation,
      t,
    ]
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {unmappedError && <FormErrorSummary errors={[{ message: unmappedError }]} />}

      {/* Section 1: Basics */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">{t('form.name')}</legend>
        <FormField
          name="template-name"
          label={t('form.name')}
          error={
            form.formState.errors.name
              ? t(
                  `validation.${form.formState.errors.name.message?.replace('validation.', '')}` as never
                )
              : undefined
          }
          required
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              {...form.register('name')}
              placeholder={t('form.namePlaceholder')}
            />
          )}
        </FormField>
        <FormField name="template-description" label={t('form.description')}>
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              {...form.register('description')}
              placeholder={t('form.descriptionPlaceholder')}
              rows={2}
            />
          )}
        </FormField>
      </fieldset>

      {/* Section 2: Branding */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">{t('form.branding')}</legend>

        {/* Logo */}
        <div className="space-y-1.5">
          <Label>{t('form.logo')}</Label>
          <TemplateLogoUpload
            currentLogoUrl={currentLogoUrl}
            onLogoUploaded={handleLogoUploaded}
            onLogoRemoved={handleLogoRemoved}
          />
        </div>

        {/* Colors */}
        <div className="grid gap-4 sm:grid-cols-3">
          <TemplateColorInput
            label={t('form.primaryColor')}
            value={primaryColor}
            onChange={setPrimaryColor}
          />
          <TemplateColorInput
            label={t('form.secondaryColor')}
            value={secondaryColor}
            onChange={setSecondaryColor}
          />
          <TemplateColorInput
            label={t('form.accentColor')}
            value={accentColor}
            onChange={setAccentColor}
          />
        </div>

        {/* Font Family */}
        <FormField name="template-font" label={t('form.fontFamily')}>
          {(fieldProps) => (
            <Select value={fontFamily} onValueChange={(v) => setFontFamily(v as FontFamily)}>
              <SelectTrigger {...fieldProps} className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {t(f === 'noto-serif' ? 'form.fontNotoSerif' : 'form.fontNotoSans')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>

        {/* Footer Text */}
        <FormField name="template-footer" label={t('form.footerText')}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              {...form.register('branding.footerText')}
              placeholder={t('form.footerTextPlaceholder')}
            />
          )}
        </FormField>
      </fieldset>

      {/* Section 3: Sections */}
      <fieldset className="space-y-4">
        <TemplateSectionEditor sections={sections} onChange={setSections} />
      </fieldset>

      {/* Section 4: Cover Page */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">{t('form.coverPage')}</legend>
        <FormField name="template-cover-title" label={t('form.coverTitle')}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              {...form.register('coverOverrides.title')}
              placeholder={t('form.coverTitlePlaceholder')}
            />
          )}
        </FormField>
        <FormField name="template-cover-subtitle" label={t('form.coverSubtitle')}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              {...form.register('coverOverrides.subtitle')}
              placeholder={t('form.coverSubtitlePlaceholder')}
            />
          )}
        </FormField>
      </fieldset>

      <DialogFooter>
        <SubmitButton isSubmitting={isPending}>
          {isEdit ? t('form.editTitle') : t('form.createTitle')}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
