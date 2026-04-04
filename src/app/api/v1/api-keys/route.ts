import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, apiCreated } from '@/lib/api/response';
import {
  generateApiKey,
  listApiKeys,
  API_KEY_ALLOWED_SORTS,
} from '@/modules/workspace/api-key.service';

const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API key name is required')
    .max(100, 'API key name must be 100 characters or fewer'),
  scope: z.enum(['read', 'read-write', 'admin']),
  expiresAt: z.coerce.date().optional(),
});

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            body: createApiKeySchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const result = await generateApiKey(
            auth.workspaceId,
            validated.data.body.name,
            validated.data.body.scope,
            validated.data.body.expiresAt
          );

          return apiCreated(result);
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
          const pagination = parsePagination(req.nextUrl.searchParams, API_KEY_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const { items, total } = await listApiKeys(auth.workspaceId, pagination);

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
