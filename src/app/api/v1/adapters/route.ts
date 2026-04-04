import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, apiCreated, conflict, unprocessable, apiError } from '@/lib/api/response';
import {
  createAdapterConfig,
  listAdapterConfigs,
  ADAPTER_ALLOWED_SORTS,
} from '@/modules/adapters/adapter.service';
import { getAdapterRegistry } from '@/modules/adapters';

const createAdapterSchema = z.object({
  platformId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
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

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            body: createAdapterSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const registry = getAdapterRegistry();

          try {
            const result = await createAdapterConfig(
              auth.workspaceId,
              validated.data.body,
              registry
            );
            return apiCreated(result);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'Failed to create adapter configuration';
            if (message.includes('already exists')) {
              return conflict(message);
            }
            if (message.includes('Unknown platform')) {
              return unprocessable([{ field: 'platformId', message }]);
            }
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

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, ADAPTER_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);

          const { items, total } = await listAdapterConfigs(auth.workspaceId, pagination);

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
