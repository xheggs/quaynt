import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { validateRequest } from '@/lib/api/validation';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, apiCreated, conflict } from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import { createScheduleSchema } from '@/modules/scheduled-reports/scheduled-report.types';
import {
  createSchedule,
  listSchedules,
} from '@/modules/scheduled-reports/scheduled-report.service';

const SCHEDULE_ALLOWED_SORTS = ['nextRunAt', 'createdAt', 'name'];

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, SCHEDULE_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const { items, total } = await listSchedules(auth.workspaceId, pagination);

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
          const validated = await validateRequest(req, ctx, {
            body: createScheduleSchema,
          });
          if (!validated.success) return validated.response;

          const auth = getAuthContext(req);
          const log = getRequestLogger(req);
          const userId = auth.method === 'session' ? auth.userId : auth.apiKeyId;

          try {
            const result = await createSchedule(auth.workspaceId, userId, validated.data.body);
            log.info({ scheduleId: result.id }, 'Report schedule created');
            return apiCreated(result);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create schedule';
            if (message === 'SCHEDULE_LIMIT_EXCEEDED') {
              return conflict('Maximum of 25 schedules per workspace reached');
            }
            throw err;
          }
        }, 'read-write'),
        { points: 10, duration: 60 }
      )
    )
  )
);
