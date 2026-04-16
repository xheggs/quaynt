import { z } from 'zod';

/**
 * Client-side alert rule form validation schemas.
 * Mirror the server-side schemas in api/v1/alerts/rules/route.ts.
 *
 * Validation error messages are i18n key strings — they are resolved
 * at render time via `t(error.message)` in FormMessage components.
 */

const alertScopeSchema = z.object({
  brandId: z.string().min(1, { message: 'validation.brandRequired' }),
  platformId: z.string().optional().or(z.literal('')),
  locale: z.string().optional().or(z.literal('')),
});

export const alertRuleCreateSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
  description: z
    .string()
    .max(1000, { message: 'validation.descriptionTooLong' })
    .optional()
    .or(z.literal('')),
  metric: z.enum(
    ['recommendation_share', 'citation_count', 'sentiment_score', 'position_average'],
    { message: 'validation.metricRequired' }
  ),
  promptSetId: z.string().min(1, { message: 'validation.promptSetRequired' }),
  scope: alertScopeSchema,
  condition: z.enum(['drops_below', 'exceeds', 'changes_by_percent', 'changes_by_absolute'], {
    message: 'validation.conditionRequired',
  }),
  threshold: z
    .number({ message: 'validation.thresholdRequired' })
    .positive({ message: 'validation.thresholdPositive' }),
  direction: z.enum(['any', 'increase', 'decrease']).default('any'),
  cooldownMinutes: z
    .number()
    .int()
    .min(1, { message: 'validation.cooldownRange' })
    .max(10080, { message: 'validation.cooldownRange' })
    .default(60),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  enabled: z.boolean().default(true),
});

export type AlertRuleFormValues = z.input<typeof alertRuleCreateSchema>;

export const alertRuleUpdateSchema = alertRuleCreateSchema.partial();

export const alertSnoozeSchema = z
  .object({
    duration: z.number().int().min(60).max(2592000).optional(),
    snoozedUntil: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      const hasDuration = data.duration !== undefined;
      const hasUntil = data.snoozedUntil !== undefined;
      return (hasDuration && !hasUntil) || (!hasDuration && hasUntil);
    },
    { message: 'validation.snoozeExactlyOne' }
  );
