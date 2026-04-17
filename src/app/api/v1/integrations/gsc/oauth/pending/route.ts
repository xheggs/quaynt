// ---------------------------------------------------------------------------
// GET /api/v1/integrations/gsc/oauth/pending
//
// Reads the pending-OAuth signed cookie set by the callback and returns the
// list of Search Console sites the user can choose from. Never returns tokens.
// ---------------------------------------------------------------------------

import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, notFound } from '@/lib/api/response';
import {
  GSC_PENDING_COOKIE_NAME,
  verifyPendingCookie,
} from '@/modules/integrations/gsc/gsc-pending-cookie';

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const cookie = req.cookies.get(GSC_PENDING_COOKIE_NAME)?.value;
          if (!cookie) return notFound('No pending GSC OAuth session');

          try {
            const pending = verifyPendingCookie(cookie);
            if (pending.workspaceId !== auth.workspaceId) {
              return notFound('No pending GSC OAuth session');
            }
            return apiSuccess({ sites: pending.sites });
          } catch {
            return notFound('No pending GSC OAuth session');
          }
        }, 'read-write')
      )
    )
  )
);
