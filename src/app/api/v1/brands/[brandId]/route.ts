import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiNoContent, notFound, conflict, unprocessable } from '@/lib/api/response';
import { getBrand, updateBrand, deleteBrand } from '@/modules/brands/brand.service';

const updateBrandSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  domain: z.string().max(255).nullable().optional(),
  aliases: z.array(z.string().max(255)).max(50).optional(),
  description: z.string().max(1000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { brandId } = await ctx.params;
          const auth = getAuthContext(req);

          const result = await getBrand(brandId, auth.workspaceId);
          if (!result) {
            return notFound('Brand');
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
          const { brandId } = await ctx.params;
          const validated = await validateRequest(req, ctx, {
            body: updateBrandSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const updated = await updateBrand(brandId, auth.workspaceId, validated.data.body);
            if (!updated) {
              return notFound('Brand');
            }
            return apiSuccess(updated);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update brand';
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

export const DELETE = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { brandId } = await ctx.params;
          const auth = getAuthContext(req);

          const deleted = await deleteBrand(brandId, auth.workspaceId);
          if (!deleted) {
            return notFound('Brand');
          }

          return apiNoContent();
        }, 'admin')
      )
    )
  )
);
