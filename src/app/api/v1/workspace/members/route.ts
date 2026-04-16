import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import {
  apiSuccess,
  apiCreated,
  forbidden,
  conflict,
  notFound,
  unprocessable,
} from '@/lib/api/response';
import {
  listWorkspaceMembers,
  addMemberByEmail,
  requireWorkspaceRole,
  MEMBER_ALLOWED_SORTS,
} from '@/modules/workspace/workspace.service';

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
});

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, MEMBER_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const search = req.nextUrl.searchParams.get('search') ?? undefined;

          const { items, total } = await listWorkspaceMembers(auth.workspaceId, pagination, search);

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
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
          const auth = getAuthContext(req);

          if (!auth.userId) {
            return forbidden('Member management requires session authentication');
          }

          try {
            await requireWorkspaceRole(auth.workspaceId, auth.userId, 'admin');
          } catch {
            return forbidden('Only admins can add members');
          }

          const validated = await validateRequest(req, ctx, {
            body: addMemberSchema,
          });
          if (!validated.success) return validated.response;

          try {
            const member = await addMemberByEmail(
              auth.workspaceId,
              validated.data.body.email,
              validated.data.body.role
            );
            return apiCreated(member);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to add member';
            if (message === 'USER_NOT_FOUND') {
              return notFound('User');
            }
            if (message === 'ALREADY_A_MEMBER') {
              return conflict('This user is already a member of this workspace');
            }
            return unprocessable([{ field: 'email', message }]);
          }
        }, 'admin'),
        { points: 10, duration: 60 }
      )
    )
  )
);
