import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, notFound, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
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
          const t = await apiErrors();
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
              return notFound(t('resources.promptSet'));
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
