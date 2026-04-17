import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiNoContent, notFound } from '@/lib/api/response';
import {
  getSiteKey,
  updateSiteKey,
  revokeSiteKey,
} from '@/modules/traffic/traffic-site-key.service';

const updateSiteKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  allowedOrigins: z.array(z.string().url()).max(20).optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { siteKeyId } = (await ctx.params) as { siteKeyId: string };
          const auth = getAuthContext(req);

          const record = await getSiteKey(auth.workspaceId, siteKeyId);
          if (!record) return notFound('Site key');
          return apiSuccess(record);
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
          const validated = await validateRequest(req, ctx, { body: updateSiteKeySchema });
          if (!validated.success) return validated.response;

          const { siteKeyId } = (await ctx.params) as { siteKeyId: string };
          const auth = getAuthContext(req);

          const record = await updateSiteKey(auth.workspaceId, siteKeyId, validated.data.body);
          if (!record) return notFound('Site key');
          return apiSuccess(record);
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
          const { siteKeyId } = (await ctx.params) as { siteKeyId: string };
          const auth = getAuthContext(req);

          const ok = await revokeSiteKey(auth.workspaceId, siteKeyId);
          if (!ok) return notFound('Site key');
          return apiNoContent();
        }, 'read-write')
      )
    )
  )
);
