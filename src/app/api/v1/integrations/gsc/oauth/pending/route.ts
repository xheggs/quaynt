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
import { apiErrors } from '@/lib/api/errors-i18n';
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
          const t = await apiErrors();
          const cookie = req.cookies.get(GSC_PENDING_COOKIE_NAME)?.value;
          if (!cookie) return notFound(t('gsc.noPendingSessionShort'));

          try {
            const pending = verifyPendingCookie(cookie);
            if (pending.workspaceId !== auth.workspaceId) {
              return notFound(t('gsc.noPendingSessionShort'));
            }
            return apiSuccess({ sites: pending.sites });
          } catch {
            return notFound(t('gsc.noPendingSessionShort'));
          }
        }, 'read-write')
      )
    )
  )
);
