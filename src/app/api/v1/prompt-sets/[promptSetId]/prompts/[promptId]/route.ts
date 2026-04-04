import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiNoContent, notFound } from '@/lib/api/response';
import { updatePrompt, deletePrompt } from '@/modules/prompt-sets/prompt-set.service';

const updatePromptSchema = z.object({
  template: z.string().min(1).max(5000).optional(),
  order: z.number().int().positive().optional(),
});

export const PATCH = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { promptSetId, promptId } = await ctx.params;
          const validated = await validateRequest(req, ctx, {
            body: updatePromptSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          const updated = await updatePrompt(
            promptId,
            promptSetId,
            auth.workspaceId,
            validated.data.body
          );
          if (!updated) {
            return notFound('Prompt');
          }

          return apiSuccess(updated);
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
          const { promptSetId, promptId } = await ctx.params;
          const auth = getAuthContext(req);

          const deleted = await deletePrompt(promptId, promptSetId, auth.workspaceId);
          if (!deleted) {
            return notFound('Prompt');
          }

          return apiNoContent();
        }, 'read-write')
      )
    )
  )
);
