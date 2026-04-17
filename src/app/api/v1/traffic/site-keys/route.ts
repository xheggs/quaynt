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
  createSiteKey,
  listSiteKeys,
  SITE_KEY_ALLOWED_SORTS,
} from '@/modules/traffic/traffic-site-key.service';

const createSiteKeySchema = z.object({
  name: z
    .string()
    .min(1, 'Site key name is required')
    .max(100, 'Site key name must be 100 characters or fewer'),
  allowedOrigins: z.array(z.string().url()).max(20).optional(),
});

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, { body: createSiteKeySchema });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const result = await createSiteKey({
            workspaceId: auth.workspaceId,
            name: validated.data.body.name,
            allowedOrigins: validated.data.body.allowedOrigins,
          });

          return apiCreated(result);
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
          const pagination = parsePagination(req.nextUrl.searchParams, SITE_KEY_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const { items, total } = await listSiteKeys(auth.workspaceId, pagination);

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
