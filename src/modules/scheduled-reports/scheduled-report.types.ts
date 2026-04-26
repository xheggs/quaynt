import { z } from 'zod';
import type { InferSelectModel } from 'drizzle-orm';
import { isDisposableEmail } from '@/lib/email/disposable-email-checker';
import type { reportSchedule, scheduleRecipient, reportDelivery } from './scheduled-report.schema';

// --- DB row types ---

export type ReportSchedule = InferSelectModel<typeof reportSchedule>;
export type ScheduleRecipient = InferSelectModel<typeof scheduleRecipient>;
export type ReportDelivery = InferSelectModel<typeof reportDelivery>;

// --- Frequency and format ---

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type ScheduleFormat = 'pdf' | 'csv' | 'json';

// --- Schedule scope (relative dates instead of absolute) ---

export interface ScheduleScope {
  promptSetId: string;
  brandIds: string[];
  periodDays: number;
  comparisonPeriod?: string;
  metrics?: string[];
  platformId?: string;
  locale?: string;
  templateId?: string;
}

// --- Recipient input ---

export interface RecipientInput {
  type: 'email' | 'webhook';
  address: string;
}

// --- API input types ---

export interface CreateReportScheduleInput {
  name: string;
  frequency: ScheduleFrequency;
  hour: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone: string;
  format: ScheduleFormat;
  scope: ScheduleScope;
  recipients: RecipientInput[];
}

export interface UpdateReportScheduleInput {
  name?: string;
  frequency?: ScheduleFrequency;
  hour?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  format?: ScheduleFormat;
  scope?: ScheduleScope;
  enabled?: boolean;
  recipients?: RecipientInput[];
}

// --- pg-boss job payload ---

export interface ScheduledReportJobData {
  scheduleId: string;
  workspaceId: string;
}

// --- Error classification ---

export const PERMANENT_ERROR_CODES = new Set([
  'BRANDS_NOT_FOUND',
  'WORKSPACE_NOT_FOUND',
  'INVALID_SCOPE',
  'PROMPT_SET_NOT_FOUND',
]);

export class SchedulePermanentError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SchedulePermanentError';
    this.code = code;
  }
}

// --- Zod validation schemas ---

const VALID_TIMEZONES = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);

const recipientSchema = z
  .object({
    type: z.enum(['email', 'webhook']),
    address: z.string().min(1),
  })
  .refine(
    (r) => {
      if (r.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.address);
      if (r.type === 'webhook') return /^https?:\/\/.+/.test(r.address);
      return false;
    },
    { message: 'Invalid recipient address for the given type' }
  )
  .refine((r) => r.type !== 'email' || !isDisposableEmail(r.address), {
    message: 'Disposable email addresses are not allowed',
    path: ['address'],
  });

const scheduleScopeSchema = z.object({
  promptSetId: z.string().min(1),
  brandIds: z.array(z.string().min(1)).min(1).max(25),
  periodDays: z.number().int().min(1).max(365),
  comparisonPeriod: z.enum(['previous_period', 'previous_week', 'previous_month']).optional(),
  metrics: z.array(z.string()).optional(),
  platformId: z.string().optional(),
  locale: z.string().optional(),
  templateId: z.string().optional(),
});

export const createScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  hour: z.number().int().min(0).max(23),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z
    .number()
    .int()
    .refine((v) => (v >= 1 && v <= 28) || v === -1, {
      message: 'dayOfMonth must be 1-28 or -1 for last day',
    })
    .optional(),
  timezone: z.string().refine((tz) => VALID_TIMEZONES.has(tz), {
    message: 'Invalid IANA timezone identifier',
  }),
  format: z.enum(['pdf', 'csv', 'json']),
  scope: scheduleScopeSchema,
  recipients: z.array(recipientSchema).min(1).max(25),
});

export const updateScheduleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z
    .number()
    .int()
    .refine((v) => (v >= 1 && v <= 28) || v === -1, {
      message: 'dayOfMonth must be 1-28 or -1 for last day',
    })
    .optional(),
  timezone: z
    .string()
    .refine((tz) => VALID_TIMEZONES.has(tz), {
      message: 'Invalid IANA timezone identifier',
    })
    .optional(),
  format: z.enum(['pdf', 'csv', 'json']).optional(),
  scope: scheduleScopeSchema.optional(),
  enabled: z.boolean().optional(),
  recipients: z.array(recipientSchema).min(1).max(25).optional(),
});

export const scheduleIdParamSchema = z.object({
  scheduleId: z.string().min(1),
});
