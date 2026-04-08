import { z } from 'zod';
import { REPORT_SECTIONS, type ReportSection } from '@/modules/pdf/pdf.types';

// --- Section config ---

export interface TemplateSectionConfig {
  id: ReportSection;
  visible: boolean;
}

export interface TemplateLayout {
  sections: TemplateSectionConfig[];
}

// --- Branding ---

export type TemplateFontFamily = 'noto-sans' | 'noto-serif';

export interface TemplateBranding {
  logoPath?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: TemplateFontFamily;
  footerText?: string;
}

// --- Cover overrides ---

export interface TemplateCoverOverrides {
  title?: string;
  subtitle?: string;
}

// --- Composite config passed to PDF renderer ---

export interface TemplateConfig {
  layout: TemplateLayout;
  branding: TemplateBranding;
  coverOverrides: TemplateCoverOverrides;
  logoBuffer?: Buffer;
}

// --- Zod schemas ---

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format — use hex (e.g., #1a2b3c)');

const reportSectionEnum = z.enum(
  REPORT_SECTIONS as unknown as [string, ...string[]]
) as z.ZodType<ReportSection>;

const sectionConfigSchema = z.object({
  id: reportSectionEnum,
  visible: z.boolean(),
});

const templateLayoutSchema = z.object({
  sections: z.array(sectionConfigSchema).min(1).max(REPORT_SECTIONS.length),
});

const templateBrandingSchema = z.object({
  logoUploadId: z.string().optional(),
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  accentColor: hexColorSchema.optional(),
  fontFamily: z.enum(['noto-sans', 'noto-serif']).optional(),
  footerText: z.string().max(200).optional(),
});

const templateCoverOverridesSchema = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(200).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  layout: templateLayoutSchema,
  branding: templateBrandingSchema.optional(),
  coverOverrides: templateCoverOverridesSchema.optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).nullable().optional(),
  layout: templateLayoutSchema.optional(),
  branding: templateBrandingSchema.optional(),
  coverOverrides: templateCoverOverridesSchema.nullable().optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// --- Font family mapping ---

export const FONT_FAMILY_MAP: Record<TemplateFontFamily, string> = {
  'noto-sans': 'NotoSans',
  'noto-serif': 'NotoSerif',
};
