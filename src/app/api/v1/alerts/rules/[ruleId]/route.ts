import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiNoContent, notFound, unprocessable } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { getAlertRule, updateAlertRule, deleteAlertRule } from '@/modules/alerts/alert.service';

const updateAlertRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  scope: z
    .object({
      brandId: z.string().min(1),
      platformId: z.string().min(1).optional(),
      locale: z.string().min(1).optional(),
    })
    .optional(),
  condition: z
    .enum(['drops_below', 'exceeds', 'changes_by_percent', 'changes_by_absolute'])
    .optional(),
  threshold: z.number().optional(),
  direction: z.enum(['any', 'increase', 'decrease']).optional(),
  cooldownMinutes: z.number().int().min(1).max(10080).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  enabled: z.boolean().optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { ruleId } = await ctx.params;
          const auth = getAuthContext(req);
          const t = await apiErrors();

          const result = await getAlertRule(ruleId, auth.workspaceId);
          if (!result) {
            return notFound(t('resources.alertRule'));
          }

          return apiSuccess(result);
        }, 'read')
      )
    )
  )
);

export const PATCH = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { ruleId } = await ctx.params;
          const t = await apiErrors();
          const validated = await validateRequest(req, ctx, {
            body: updateAlertRuleSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const updated = await updateAlertRule(ruleId, auth.workspaceId, validated.data.body);
            if (!updated) {
              return notFound(t('resources.alertRule'));
            }
            return apiSuccess(updated);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update alert rule';
            if (message.includes('Cannot change')) {
              return unprocessable([{ field: 'metric', message }]);
            }
            if (message.includes('not found')) {
              return notFound(message);
            }
            return unprocessable([{ field: 'name', message }]);
          }
        }, 'read-write')
      )
    )
  )
);

export const DELETE = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { ruleId } = await ctx.params;
          const auth = getAuthContext(req);
          const t = await apiErrors();

          const deleted = await deleteAlertRule(ruleId, auth.workspaceId);
          if (!deleted) {
            return notFound(t('resources.alertRule'));
          }

          return apiNoContent();
        }, 'admin')
      )
    )
  )
);
