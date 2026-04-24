import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { apiSuccess, badRequest } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { listAlertEvents, ALERT_EVENT_ALLOWED_SORTS } from '@/modules/alerts/alert.service';
import type { AlertSeverity, AlertEventStatus } from '@/modules/alerts/alert.types';

const VALID_SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical'];
const VALID_STATUSES: AlertEventStatus[] = ['active', 'acknowledged', 'snoozed'];

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const pagination = parsePagination(req.nextUrl.searchParams, ALERT_EVENT_ALLOWED_SORTS);
          if (pagination instanceof NextResponse) return pagination;

          const auth = getAuthContext(req);
          const t = await apiErrors();
          const params = req.nextUrl.searchParams;

          const severity = params.get('severity') as AlertSeverity | null;
          if (severity && !VALID_SEVERITIES.includes(severity)) {
            return badRequest(
              t('alerts.invalidSeverityFilter', { allowed: VALID_SEVERITIES.join(', ') })
            );
          }

          const status = params.get('status') as AlertEventStatus | null;
          if (status && !VALID_STATUSES.includes(status)) {
            return badRequest(
              t('alerts.invalidStatusFilter', { allowed: VALID_STATUSES.join(', ') })
            );
          }

          const { items, total } = await listAlertEvents(auth.workspaceId, pagination, {
            alertRuleId: params.get('alertRuleId') ?? undefined,
            severity: severity ?? undefined,
            status: status ?? undefined,
            from: params.get('from') ?? undefined,
            to: params.get('to') ?? undefined,
          });

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
