import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { apiSuccess, forbidden, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
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
          const t = await apiErrors();

          const ws = await getWorkspaceById(auth.workspaceId);
          if (!ws) {
            return notFound(t('resources.workspace'));
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
          const t = await apiErrors();

          if (!auth.userId) {
            return forbidden(t('workspace.updatesSessionRequired'));
          }

          try {
            await requireWorkspaceRole(auth.workspaceId, auth.userId, 'admin');
          } catch {
            return forbidden(t('workspace.onlyAdminsUpdateSettings'));
          }

          const validated = await validateRequest(req, ctx, {
            body: updateWorkspaceSchema,
          });
          if (!validated.success) return validated.response;

          const updated = await updateWorkspace(auth.workspaceId, validated.data.body);
          if (!updated) {
            return notFound(t('resources.workspace'));
          }

          return apiSuccess(updated);
        }, 'read-write')
      )
    )
  )
);
