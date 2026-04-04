import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiNoContent, notFound, unprocessable, apiError } from '@/lib/api/response';
import {
  getAdapterConfig,
  updateAdapterConfig,
  deleteAdapterConfig,
} from '@/modules/adapters/adapter.service';
import { getAdapterRegistry } from '@/modules/adapters';

const updateAdapterSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  rateLimitPoints: z.number().int().min(1).max(10000).optional(),
  rateLimitDuration: z.number().int().min(1).max(86400).optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  circuitBreakerThreshold: z.number().int().min(1).max(100).optional(),
  circuitBreakerResetMs: z.number().int().min(1000).max(600000).optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { adapterId } = await ctx.params;
          const auth = getAuthContext(req);

          const result = await getAdapterConfig(adapterId, auth.workspaceId);
          if (!result) {
            return notFound('Adapter');
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
          const { adapterId } = await ctx.params;
          const validated = await validateRequest(req, ctx, {
            body: updateAdapterSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const registry = getAdapterRegistry();

          try {
            const updated = await updateAdapterConfig(
              adapterId,
              auth.workspaceId,
              validated.data.body,
              registry
            );
            if (!updated) {
              return notFound('Adapter');
            }
            return apiSuccess(updated);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Failed to update adapter configuration';
            if (message.includes('encryption key')) {
              return apiError('INTERNAL_ERROR', message, 500);
            }
            return unprocessable([{ field: 'credentials', message }]);
          }
        }, 'admin')
      )
    )
  )
);

export const DELETE = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { adapterId } = await ctx.params;
          const auth = getAuthContext(req);

          const deleted = await deleteAdapterConfig(adapterId, auth.workspaceId);
          if (!deleted) {
            return notFound('Adapter');
          }

          return apiNoContent();
        }, 'admin')
      )
    )
  )
);
