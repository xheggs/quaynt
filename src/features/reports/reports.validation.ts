import { z } from 'zod';

/**
 * Client-side report form validation schemas.
 * Mirror the server-side schemas in api/v1/reports/ routes.
 *
 * Validation error messages are i18n key strings — they are resolved
 * at render time via `t(error.message)` in FormMessage components.
 */

export const reportGenerateSchema = z
  .object({
    promptSetId: z.string().min(1, { message: 'validation.promptSetRequired' }),
    brandIds: z
      .array(z.string())
      .min(1, { message: 'validation.brandsRequired' })
      .max(25, { message: 'validation.brandsTooMany' }),
    format: z.enum(['pdf', 'csv', 'json', 'jsonl'], {
      message: 'validation.formatRequired',
    }),
    templateId: z.string().optional().or(z.literal('')),
    comparisonPeriod: z.enum(['previous_period', 'previous_week', 'previous_month']).optional(),
    from: z.string().optional().or(z.literal('')),
    to: z.string().optional().or(z.literal('')),
    platformId: z.string().optional().or(z.literal('')),
    locale: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.to) > new Date(data.from);
      }
      return true;
    },
    { message: 'validation.dateRangeInvalid', path: ['to'] }
  );

export type ReportGenerateFormValues = z.input<typeof reportGenerateSchema>;

export const reportScheduleCreateSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
  description: z
    .string()
    .max(1000, { message: 'validation.descriptionTooLong' })
    .optional()
    .or(z.literal('')),
  promptSetId: z.string().min(1, { message: 'validation.promptSetRequired' }),
  brandIds: z
    .array(z.string())
    .min(1, { message: 'validation.brandsRequired' })
    .max(25, { message: 'validation.brandsTooMany' }),
  schedule: z.string().min(1, { message: 'validation.scheduleRequired' }),
  recipients: z
    .array(z.string().email({ message: 'validation.recipientInvalid' }))
    .min(1, { message: 'validation.recipientsRequired' })
    .max(50),
  format: z.enum(['pdf'] as const, { message: 'validation.formatRequired' }),
  templateId: z.string().optional().or(z.literal('')),
  enabled: z.boolean().default(true),
  sendIfEmpty: z.boolean().default(false),
});

export type ReportScheduleFormValues = z.input<typeof reportScheduleCreateSchema>;

export const reportScheduleUpdateSchema = reportScheduleCreateSchema.partial();

// --- Report Templates ---

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'validation.invalidColor' })
  .optional();

export const reportTemplateCreateSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
  description: z
    .string()
    .max(1000, { message: 'validation.descriptionTooLong' })
    .optional()
    .or(z.literal('')),
  branding: z
    .object({
      logoUploadId: z.string().optional(),
      primaryColor: hexColorSchema,
      secondaryColor: hexColorSchema,
      accentColor: hexColorSchema,
      fontFamily: z.enum(['noto-sans', 'noto-serif']).optional(),
      footerText: z
        .string()
        .max(500, { message: 'validation.footerTooLong' })
        .optional()
        .or(z.literal('')),
    })
    .optional(),
  sections: z
    .object({
      cover: z.boolean().optional(),
      executiveSummary: z.boolean().optional(),
      recommendationShare: z.boolean().optional(),
      competitorBenchmarks: z.boolean().optional(),
      opportunities: z.boolean().optional(),
      citationSources: z.boolean().optional(),
      alertSummary: z.boolean().optional(),
      sectionOrder: z
        .array(
          z.enum([
            'cover',
            'executiveSummary',
            'recommendationShare',
            'competitorBenchmarks',
            'opportunities',
            'citationSources',
            'alertSummary',
          ])
        )
        .optional(),
    })
    .optional(),
  coverOverrides: z
    .object({
      title: z
        .string()
        .max(255, { message: 'validation.coverTitleTooLong' })
        .optional()
        .or(z.literal('')),
      subtitle: z
        .string()
        .max(500, { message: 'validation.coverSubtitleTooLong' })
        .optional()
        .or(z.literal('')),
    })
    .optional(),
});

export type ReportTemplateFormValues = z.input<typeof reportTemplateCreateSchema>;

export const reportTemplateUpdateSchema = reportTemplateCreateSchema.partial();

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

export const logoUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => f.size <= MAX_LOGO_SIZE, {
      message: 'validation.logoTooLarge',
    })
    .refine((f) => ['image/png', 'image/jpeg'].includes(f.type), {
      message: 'validation.logoInvalidType',
    }),
});
