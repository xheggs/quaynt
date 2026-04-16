import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, forbidden, notFound } from '@/lib/api/response';
import {
  getWorkspaceById,
  updateWorkspace,
  requireWorkspaceRole,
} from '@/modules/workspace/workspace.service';

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).trim(),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);

          const ws = await getWorkspaceById(auth.workspaceId);
          if (!ws) {
            return notFound('Workspace');
          }

          return apiSuccess(ws);
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
          const auth = getAuthContext(req);

          if (!auth.userId) {
            return forbidden('Workspace updates require session authentication');
          }

          try {
            await requireWorkspaceRole(auth.workspaceId, auth.userId, 'admin');
          } catch {
            return forbidden('Only admins can update workspace settings');
          }

          const validated = await validateRequest(req, ctx, {
            body: updateWorkspaceSchema,
          });
          if (!validated.success) return validated.response;

          const updated = await updateWorkspace(auth.workspaceId, validated.data.body);
          if (!updated) {
            return notFound('Workspace');
          }

          return apiSuccess(updated);
        }, 'read-write')
      )
    )
  )
);
