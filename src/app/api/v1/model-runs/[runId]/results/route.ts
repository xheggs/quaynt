import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, notFound } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import {
  listModelRunResults,
  MODEL_RUN_RESULT_ALLOWED_SORTS,
} from '@/modules/model-runs/model-run.service';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req, ctx) => {
          const { runId } = await ctx.params;
          const pagination = parsePagination(
            req.nextUrl.searchParams,
            MODEL_RUN_RESULT_ALLOWED_SORTS
          );
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const t = await apiErrors();

          const filters = {
            status: req.nextUrl.searchParams.get('status') ?? undefined,
            adapterConfigId: req.nextUrl.searchParams.get('adapterConfigId') ?? undefined,
          };

          const result = await listModelRunResults(runId, auth.workspaceId, pagination, filters);

          if (!result) {
            return notFound(t('resources.modelRun'));
          }

          return apiSuccess(
            formatPaginatedResponse(result.items, result.total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
