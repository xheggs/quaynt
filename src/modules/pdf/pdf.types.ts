import { z } from 'zod';
import type { ReportDataResponse } from '@/modules/reports/report-data.types';

// --- Report sections ---

export const REPORT_SECTIONS = [
  'cover',
  'executiveSummary',
  'recommendationShare',
  'competitorBenchmarks',
  'opportunities',
  'citationSources',
  'alertSummary',
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const DEFAULT_SECTION_ORDER: ReportSection[] = [...REPORT_SECTIONS];

// --- Page dimensions (A4 in points: 595.28 x 841.89) ---

export const PAGE_DIMENSIONS = {
  width: 595.28,
  height: 841.89,
  margin: { top: 40, right: 40, bottom: 60, left: 40 },
} as const;

export const CHART_DIMENSIONS = {
  width: 500,
  height: 300,
  scale: 2, // 2x for retina-quality PNG
} as const;

// --- Request validation schema ---

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const pdfReportRequestSchema = z.object({
  promptSetId: z.string().min(1),
  brandId: z.string().optional(),
  brandIds: z.string().optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  comparisonPeriod: z.enum(['previous_period', 'previous_week', 'previous_month']).optional(),
  metrics: z.string().optional(),
  platformId: z.string().optional(),
  locale: z.string().default('en'),
});

export type PdfReportRequest = z.infer<typeof pdfReportRequestSchema>;

// --- PDF generation config (internal) ---

export interface PdfReportConfig {
  jobId: string;
  workspaceId: string;
  workspaceName: string;
  scope: {
    promptSetId: string;
    brandIds: string[];
    from?: string;
    to?: string;
    comparisonPeriod?: string;
    metrics?: string[];
    platformId?: string;
  };
  locale: string;
  storagePath: string;
}

// --- Generation result ---

export interface PdfGenerationResult {
  filePath: string;
  fileSizeBytes: number;
  pageCount: number;
}

// --- pg-boss job payload ---

export interface ReportPdfJobData {
  jobId: string;
  workspaceId: string;
  workspaceName: string;
  scope: PdfReportConfig['scope'];
  locale: string;
}

// --- Translated strings passed to templates ---

export interface PdfTranslations {
  cover: {
    title: string;
    subtitle: string;
    dateRange: string;
    generatedAt: string;
    brands: string;
  };
  executive: {
    title: string;
    periodLabel: string;
    comparisonLabel: string;
    noChange: string;
  };
  kpi: Record<string, string>;
  sections: Record<string, string>;
  charts: Record<string, string>;
  tables: Record<string, string>;
  footer: {
    generatedBy: string;
    page: string;
  };
  warnings: Record<string, string>;
  direction: Record<string, string>;
}

// --- Template props ---

export interface ReportDocumentProps {
  reportData: ReportDataResponse;
  translations: PdfTranslations;
  charts: Record<string, Buffer>;
  locale: string;
  workspaceName: string;
  generatedAt: string;
}

// --- Error classification ---

export class PdfPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfPermanentError';
  }
}

export class PdfTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfTransientError';
  }
}
