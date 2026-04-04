import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiNoContent, notFound, conflict, unprocessable } from '@/lib/api/response';
import {
  getPromptSet,
  updatePromptSet,
  deletePromptSet,
} from '@/modules/prompt-sets/prompt-set.service';

const updatePromptSetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { promptSetId } = await ctx.params;
          const auth = getAuthContext(req);

          const result = await getPromptSet(promptSetId, auth.workspaceId);
          if (!result) {
            return notFound('Prompt set');
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
          const { promptSetId } = await ctx.params;
          const validated = await validateRequest(req, ctx, {
            body: updatePromptSetSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const updated = await updatePromptSet(
              promptSetId,
              auth.workspaceId,
              validated.data.body
            );
            if (!updated) {
              return notFound('Prompt set');
            }
            return apiSuccess(updated);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update prompt set';
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
          const { promptSetId } = await ctx.params;
          const auth = getAuthContext(req);

          const deleted = await deletePromptSet(promptSetId, auth.workspaceId);
          if (!deleted) {
            return notFound('Prompt set');
          }

          return apiNoContent();
        }, 'admin')
      )
    )
  )
);
