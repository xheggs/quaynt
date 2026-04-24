/**
 * Client-side report and export types.
 *
 * These mirror the server-side types from @/modules/reports/ and @/modules/exports/
 * but are duplicated here to avoid importing from server modules, which can pull in
 * server-side dependencies through barrel re-exports and break client component bundling.
 */

// Source: @/modules/reports/report.types
export type ReportFormat = 'pdf' | 'csv' | 'json' | 'jsonl';

// Source: @/modules/exports/export.types
export type ExportType =
  | 'report'
  | 'citations'
  | 'opportunities'
  | 'recommendation-share'
  | 'sentiment'
  | 'positions';

// Source: @/modules/reports/report.types
export type ReportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Derived client-side type — not stored in DB
export type ScheduleStatus = 'active' | 'paused' | 'disabled';

// Source: @/modules/reports/report.types
export type DeliveryStatus = 'pending' | 'sent' | 'failed';

// Source: @/modules/reports/report.types
export type ComparisonPeriod = 'previous_period' | 'previous_week' | 'previous_month';

// Source: @/modules/reports/report.types
export interface ReportGenerateInput {
  promptSetId: string;
  brandIds: string[];
  format: ReportFormat;
  templateId?: string;
  comparisonPeriod?: ComparisonPeriod;
  metrics?: string[];
  from?: string;
  to?: string;
  platformId?: string;
  locale?: string;
}

// Source: @/modules/reports/report.schema (reportJob table shape)
export interface ReportJob {
  jobId: string;
  status: ReportJobStatus;
  promptSetId: string;
  brandIds: string[];
  templateId?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt?: string;
  error?: string;
}

// Source: @/modules/reports/report.schema (reportSchedule table shape)
export interface ReportSchedule {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  promptSetId: string;
  brandIds: string[];
  schedule: string;
  templateId?: string;
  recipients: string[];
  format: ReportFormat;
  enabled: boolean;
  sendIfEmpty: boolean;
  consecutiveFailures: number;
  lastDeliveredAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Source: @/modules/reports/report.types
export interface ReportScheduleCreate {
  name: string;
  description?: string;
  promptSetId: string;
  brandIds: string[];
  schedule: string;
  templateId?: string;
  recipients: string[];
  format: ReportFormat;
  enabled?: boolean;
  sendIfEmpty?: boolean;
}

// Source: @/modules/reports/report.types
export interface ReportScheduleUpdate {
  name?: string;
  description?: string;
  promptSetId?: string;
  brandIds?: string[];
  schedule?: string;
  templateId?: string;
  recipients?: string[];
  format?: ReportFormat;
  enabled?: boolean;
  sendIfEmpty?: boolean;
}

// Source: @/modules/reports/report.schema (reportDelivery table shape)
export interface ReportDelivery {
  id: string;
  scheduleId: string;
  status: DeliveryStatus;
  format: ReportFormat;
  recipientCount: number;
  sentAt?: string;
  failureReason?: string;
  createdAt: string;
}

// Source: client-side only — cron preset for schedule form
export interface CronPreset {
  labelKey: string;
  value: string;
}

// --- Helper constants ---

export const REPORT_FORMATS: ReportFormat[] = ['pdf', 'csv', 'json', 'jsonl'];

export const EXPORT_TYPES: ExportType[] = [
  'report',
  'citations',
  'opportunities',
  'recommendation-share',
  'sentiment',
  'positions',
];

export const JOB_STATUSES: ReportJobStatus[] = ['pending', 'processing', 'completed', 'failed'];

export const COMPARISON_PERIODS: ComparisonPeriod[] = [
  'previous_period',
  'previous_week',
  'previous_month',
];

export const CRON_PRESETS: CronPreset[] = [
  { labelKey: 'form.schedulePresets.daily', value: '0 9 * * *' },
  { labelKey: 'form.schedulePresets.weeklyMonday', value: '0 9 * * MON' },
  { labelKey: 'form.schedulePresets.monthlyFirst', value: '0 9 1 * *' },
  { labelKey: 'form.schedulePresets.firstMondayMonthly', value: '0 9 * * MON#1' },
];

/**
 * Derives the effective status of a report schedule.
 * Priority: auto-disabled (5+ failures) > paused (!enabled) > active
 */
export function deriveScheduleStatus(schedule: ReportSchedule): ScheduleStatus {
  if (schedule.consecutiveFailures >= 5) return 'disabled';
  if (!schedule.enabled) return 'paused';
  return 'active';
}

// --- Report Templates ---

// Source: @/modules/report-templates/report-template.types
export type ReportSection =
  | 'cover'
  | 'executiveSummary'
  | 'recommendationShare'
  | 'competitorBenchmarks'
  | 'opportunities'
  | 'citationSources'
  | 'alertSummary'
  | 'geoScore'
  | 'seoScore'
  | 'dualScore';

// Source: @/modules/report-templates/report-template.types
export type FontFamily = 'noto-sans' | 'noto-serif';

// Source: @/modules/report-templates/report-template.types
export interface TemplateBranding {
  logoUploadId?: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: FontFamily;
  footerText?: string;
}

// Source: @/modules/report-templates/report-template.types
export type TemplateSections = Record<ReportSection, boolean> & {
  sectionOrder: ReportSection[];
};

// Source: @/modules/report-templates/report-template.types
export interface TemplateCoverOverrides {
  title?: string;
  subtitle?: string;
}

// Source: @/modules/report-templates/report-template.schema (reportTemplate table shape)
export interface ReportTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  branding: TemplateBranding;
  sections: TemplateSections;
  coverOverrides: TemplateCoverOverrides;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Source: @/modules/report-templates/report-template.types
export interface ReportTemplateCreate {
  name: string;
  description?: string;
  branding: Partial<TemplateBranding>;
  sections?: Partial<TemplateSections>;
  coverOverrides?: TemplateCoverOverrides;
}

// Source: @/modules/report-templates/report-template.types
export interface ReportTemplateUpdate {
  name?: string;
  description?: string;
  branding?: Partial<TemplateBranding>;
  sections?: Partial<TemplateSections>;
  coverOverrides?: TemplateCoverOverrides;
}

// Source: @/modules/report-templates/report-template.types
export interface LogoUploadResponse {
  uploadId: string;
}

export const REPORT_SECTIONS: ReportSection[] = [
  'cover',
  'executiveSummary',
  'recommendationShare',
  'competitorBenchmarks',
  'opportunities',
  'citationSources',
  'alertSummary',
  'geoScore',
  'seoScore',
  'dualScore',
];

export const FONT_FAMILIES: FontFamily[] = ['noto-sans', 'noto-serif'];

export const DEFAULT_COLORS = {
  primaryColor: '#9B70BC',
  secondaryColor: '#1A1A1A',
  accentColor: '#2563EB',
} as const;

export const MAX_TEMPLATES_PER_WORKSPACE = 25;
