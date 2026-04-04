import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, apiCreated, conflict, unprocessable } from '@/lib/api/response';
import { createBrand, listBrands, BRAND_ALLOWED_SORTS } from '@/modules/brands/brand.service';

const createBrandSchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  aliases: z.array(z.string().max(255)).max(50).optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            body: createBrandSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const result = await createBrand(auth.workspaceId, validated.data.body);
            return apiCreated(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create brand';
            if (message.includes('already exists')) {
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
          const pagination = parsePagination(req.nextUrl.searchParams, BRAND_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const search = req.nextUrl.searchParams.get('search') ?? undefined;

          const { items, total } = await listBrands(auth.workspaceId, pagination, search);

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
