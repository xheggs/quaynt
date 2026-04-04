import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, apiCreated, conflict, notFound, unprocessable } from '@/lib/api/response';
import {
  createAlertRule,
  listAlertRules,
  ALERT_RULE_ALLOWED_SORTS,
} from '@/modules/alerts/alert.service';
import type { AlertMetric } from '@/modules/alerts/alert.types';

const createAlertRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  metric: z.enum(['recommendation_share', 'citation_count', 'sentiment_score', 'position_average']),
  promptSetId: z.string().min(1),
  scope: z.object({
    brandId: z.string().min(1),
    platformId: z.string().min(1).optional(),
    locale: z.string().min(1).optional(),
  }),
  condition: z.enum(['drops_below', 'exceeds', 'changes_by_percent', 'changes_by_absolute']),
  threshold: z.number(),
  direction: z.enum(['any', 'increase', 'decrease']).default('any'),
  cooldownMinutes: z.number().int().min(1).max(10080).default(60),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
  enabled: z.boolean().default(true),
});

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            body: createAlertRuleSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const result = await createAlertRule(auth.workspaceId, validated.data.body);
            return apiCreated(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create alert rule';
            if (message.includes('not found')) {
              return notFound(message);
            }
            if (message.includes('limit reached')) {
              return conflict(message);
            }
            return unprocessable([{ field: 'name', message }]);
          }
        }, 'read-write')
      )
    )
  )
);

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, ALERT_RULE_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const metric = req.nextUrl.searchParams.get('metric') as AlertMetric | null;
          const enabledParam = req.nextUrl.searchParams.get('enabled');
          const enabled = enabledParam === null ? undefined : enabledParam === 'true';

          const { items, total } = await listAlertRules(auth.workspaceId, pagination, {
            metric: metric ?? undefined,
            enabled,
          });

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
