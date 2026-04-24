import { z } from 'zod';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import {
  apiSuccess,
  apiNoContent,
  forbidden,
  notFound,
  conflict,
  unprocessable,
} from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import {
  updateMemberRole,
  removeMember,
  requireWorkspaceRole,
} from '@/modules/workspace/workspace.service';

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

export const PATCH = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { memberId } = await ctx.params;
          const auth = getAuthContext(req);
          const t = await apiErrors();

          if (!auth.userId) {
            return forbidden(t('workspace.membersSessionRequired'));
          }

          try {
            await requireWorkspaceRole(auth.workspaceId, auth.userId, 'admin');
          } catch {
            return forbidden(t('workspace.onlyAdminsChangeRoles'));
          }

          const validated = await validateRequest(req, ctx, {
            body: updateRoleSchema,
          });
          if (!validated.success) return validated.response;

          try {
            const updated = await updateMemberRole(
              auth.workspaceId,
              memberId,
              validated.data.body.role,
              auth.userId
            );
            return apiSuccess(updated);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update role';
            if (message === 'MEMBER_NOT_FOUND') {
              return notFound(t('resources.member'));
            }
            if (message === 'CANNOT_CHANGE_OWN_ROLE') {
              return conflict(t('workspace.selfRoleChange'));
            }
            if (message === 'CANNOT_REMOVE_SOLE_OWNER') {
              return conflict(t('workspace.soleOwnerDemote'));
            }
            return unprocessable([{ field: 'role', message }]);
          }
        }, 'admin')
      )
    )
  )
);

export const DELETE = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { memberId } = await ctx.params;
          const auth = getAuthContext(req);
          const t = await apiErrors();

          if (!auth.userId) {
            return forbidden(t('workspace.membersSessionRequired'));
          }

          try {
            await requireWorkspaceRole(auth.workspaceId, auth.userId, 'admin');
          } catch {
            return forbidden(t('workspace.onlyAdminsRemoveMembers'));
          }

          try {
            await removeMember(auth.workspaceId, memberId, auth.userId);
            return apiNoContent();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to remove member';
            if (message === 'MEMBER_NOT_FOUND') {
              return notFound(t('resources.member'));
            }
            if (message === 'CANNOT_REMOVE_SELF') {
              return conflict(t('workspace.selfRemove'));
            }
            if (message === 'CANNOT_REMOVE_SOLE_OWNER') {
              return conflict(t('workspace.soleOwnerRemove'));
            }
            return unprocessable([{ field: 'memberId', message }]);
          }
        }, 'admin')
      )
    )
  )
);
