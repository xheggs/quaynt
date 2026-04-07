import { z } from 'zod';

export type ExportFormat = 'csv' | 'json' | 'jsonl' | 'pdf';

export const EXPORT_FORMATS: ExportFormat[] = ['csv', 'json', 'jsonl', 'pdf'];

/** Formats supported by the streaming export endpoint (GET /api/v1/exports) */
export const STREAMING_EXPORT_FORMATS: ExportFormat[] = ['csv', 'json', 'jsonl'];

export type ExportType =
  | 'report'
  | 'citations'
  | 'opportunities'
  | 'recommendation-share'
  | 'sentiment'
  | 'positions';

export const EXPORT_TYPES: ExportType[] = [
  'report',
  'citations',
  'opportunities',
  'recommendation-share',
  'sentiment',
  'positions',
];

export interface ExportColumnDef {
  /** Key on the row object to read the value from */
  key: string;
  /** i18n key for the column header (e.g. 'exports.columns.brandName') */
  i18nKey: string;
}

export const MAX_EXPORT_ROWS = 100_000;
export const EXPORT_PAGE_SIZE = 1000;

export interface ExportFetcherResult {
  rows: AsyncIterable<Record<string, unknown>>;
  warnings?: string[];
  truncated?: boolean;
}

// --- Zod schemas for each export type's query params ---

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const reportExportSchema = z.object({
  promptSetId: z.string().min(1),
  brandId: z.string().optional(),
  brandIds: z.string().optional(),
  from: dateString,
  to: dateString,
  comparisonPeriod: z.enum(['previous_period', 'previous_week', 'previous_month']).optional(),
  metrics: z.string().optional(),
  platformId: z.string().optional(),
  locale: z.string().optional(),
});

export const citationsExportSchema = z.object({
  brandId: z.string().optional(),
  platformId: z.string().optional(),
  citationType: z.enum(['owned', 'earned']).optional(),
  locale: z.string().optional(),
  sentimentLabel: z.enum(['positive', 'neutral', 'negative']).optional(),
  from: dateString,
  to: dateString,
});

export const opportunitiesExportSchema = z.object({
  promptSetId: z.string().min(1),
  brandId: z.string().min(1),
  type: z.enum(['missing', 'weak']).optional(),
  platformId: z.string().optional(),
  from: dateString,
  to: dateString,
});

const visibilityExportSchema = z.object({
  promptSetId: z.string().min(1),
  brandId: z.string().optional(),
  platformId: z.string().optional(),
  locale: z.string().optional(),
  from: dateString,
  to: dateString,
});

export const recommendationShareExportSchema = visibilityExportSchema;
export const sentimentExportSchema = visibilityExportSchema;
export const positionsExportSchema = visibilityExportSchema;

export const exportSchemas: Record<ExportType, z.ZodSchema> = {
  report: reportExportSchema,
  citations: citationsExportSchema,
  opportunities: opportunitiesExportSchema,
  'recommendation-share': recommendationShareExportSchema,
  sentiment: sentimentExportSchema,
  positions: positionsExportSchema,
};
