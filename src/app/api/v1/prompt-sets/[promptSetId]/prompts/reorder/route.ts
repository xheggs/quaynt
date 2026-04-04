import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, notFound, badRequest } from '@/lib/api/response';
import { reorderPrompts } from '@/modules/prompt-sets/prompt-set.service';

const reorderPromptsSchema = z.object({
  promptIds: z.array(z.string()).min(1),
});

export const PUT = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { promptSetId } = await ctx.params;
          const validated = await validateRequest(req, ctx, {
            body: reorderPromptsSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const result = await reorderPrompts(
              promptSetId,
              auth.workspaceId,
              validated.data.body.promptIds
            );
            if (result === null) {
              return notFound('Prompt set');
            }
            return apiSuccess({ reordered: true });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to reorder prompts';
            return badRequest(message);
          }
        }, 'read-write')
      )
    )
  )
);
