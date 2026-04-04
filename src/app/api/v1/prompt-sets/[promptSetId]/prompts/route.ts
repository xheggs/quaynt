import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, apiCreated, notFound, unprocessable } from '@/lib/api/response';
import { listPrompts, addPrompt } from '@/modules/prompt-sets/prompt-set.service';

const createPromptSchema = z.object({
  template: z.string().min(1).max(5000),
  order: z.number().int().positive().optional(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { promptSetId } = await ctx.params;
          const auth = getAuthContext(req);

          const result = await listPrompts(promptSetId, auth.workspaceId);
          if (result === null) {
            return notFound('Prompt set');
          }

          return apiSuccess(result);
        }, 'read')
      )
    )
  )
);

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { promptSetId } = await ctx.params;
          const validated = await validateRequest(req, ctx, {
            body: createPromptSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const result = await addPrompt(promptSetId, auth.workspaceId, validated.data.body);
            if (result === null) {
              return notFound('Prompt set');
            }
            return apiCreated(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to add prompt';
            return unprocessable([{ field: 'template', message }]);
          }
        }, 'read-write')
      )
    )
  )
);
