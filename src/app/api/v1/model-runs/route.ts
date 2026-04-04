import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiCreated, apiSuccess, notFound, unprocessable } from '@/lib/api/response';
import {
  createModelRun,
  listModelRuns,
  MODEL_RUN_ALLOWED_SORTS,
} from '@/modules/model-runs/model-run.service';
import { createBoss } from '@/lib/jobs/boss';
import { isValidLocale, normalizeLocale } from '@/lib/locale/locale';

const createModelRunSchema = z.object({
  promptSetId: z.string().min(1),
  brandId: z.string().min(1),
  adapterConfigIds: z.array(z.string().min(1)).min(1).max(10),
  locale: z
    .string()
    .max(35)
    .optional()
    .refine((v) => !v || isValidLocale(v), {
      message: 'Invalid locale format. Expected BCP 47 tag with region (e.g., en-US, de-DE)',
    })
    .transform((v) => (v ? normalizeLocale(v) : undefined)),
  market: z.string().max(255).optional(),
});

export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const validated = await validateRequest(req, ctx, {
            body: createModelRunSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const boss = createBoss();

          try {
            const result = await createModelRun(auth.workspaceId, validated.data.body, boss);
            return apiCreated(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create model run';
            if (message.includes('not found')) {
              return notFound(message);
            }
            if (message.includes('disabled')) {
              return unprocessable([{ field: 'adapterConfigIds', message }]);
            }
            return unprocessable([{ field: 'promptSetId', message }]);
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
          const pagination = parsePagination(req.nextUrl.searchParams, MODEL_RUN_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);

          const filters = {
            status: req.nextUrl.searchParams.get('status') ?? undefined,
            promptSetId: req.nextUrl.searchParams.get('promptSetId') ?? undefined,
            brandId: req.nextUrl.searchParams.get('brandId') ?? undefined,
            locale: req.nextUrl.searchParams.get('locale') ?? undefined,
            from: req.nextUrl.searchParams.get('from') ?? undefined,
            to: req.nextUrl.searchParams.get('to') ?? undefined,
          };

          const { items, total } = await listModelRuns(auth.workspaceId, pagination, filters);

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
