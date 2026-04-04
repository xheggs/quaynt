import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, apiCreated, conflict, unprocessable } from '@/lib/api/response';
import {
  createPromptSet,
  listPromptSets,
  PROMPT_SET_ALLOWED_SORTS,
} from '@/modules/prompt-sets/prompt-set.service';

const createPromptSetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
});

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            body: createPromptSetSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);

          try {
            const result = await createPromptSet(auth.workspaceId, validated.data.body);
            return apiCreated(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create prompt set';
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

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, PROMPT_SET_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const search = req.nextUrl.searchParams.get('search') ?? undefined;
          const tag = req.nextUrl.searchParams.get('tag') ?? undefined;

          const { items, total } = await listPromptSets(auth.workspaceId, pagination, {
            search,
            tag,
          });

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
