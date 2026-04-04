import { NextRequest } from 'next/server';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, badRequest } from '@/lib/api/response';
import {
  validateUnsubscribeToken,
  updatePreference,
} from '@/modules/notifications/notification.service';

export const GET = withRequestId(
  withRequestLog(async (req: NextRequest) => {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return badRequest('Token is required');
    }

    const result = await validateUnsubscribeToken(token);
    if (!result.valid) {
      return badRequest(
        result.error === 'NOT_MEMBER'
          ? 'User is not a member of this workspace'
          : 'Invalid unsubscribe token',
        { code: result.error }
      );
    }

    return apiSuccess({
      userId: result.userId,
      workspaceId: result.workspaceId,
      channel: result.channel,
    });
  })
);

export const POST = withRequestId(
  withRequestLog(async (req: NextRequest) => {
    // Support token from query string (RFC 8058 one-click) or JSON body
    let token = req.nextUrl.searchParams.get('token');

    if (!token) {
      try {
        const body = await req.json();
        token = body.token;
      } catch {
        // no-op
      }
    }

    if (!token) {
      return badRequest('Token is required');
    }

    const result = await validateUnsubscribeToken(token);
    if (!result.valid) {
      return badRequest(
        result.error === 'NOT_MEMBER'
          ? 'User is not a member of this workspace'
          : 'Invalid unsubscribe token',
        { code: result.error }
      );
    }

    await updatePreference(result.workspaceId, result.userId, result.channel, {
      enabled: false,
    });

    return apiSuccess({ unsubscribed: true });
  })
);
