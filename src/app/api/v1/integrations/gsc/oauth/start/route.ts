// ---------------------------------------------------------------------------
// GET /api/v1/integrations/gsc/oauth/start
//
// Initiates the Google OAuth flow for Search Console. Returns `{ authUrl }`
// and sets a short-lived CSRF cookie containing the nonce carried in the
// signed `state` parameter.
// ---------------------------------------------------------------------------

import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiSuccess, apiError } from '@/lib/api/response';
import { buildAuthUrl, OAuthConfigError } from '@/modules/integrations/gsc/gsc-oauth.service';
import { GSC_CSRF_COOKIE_NAME } from '@/modules/integrations/gsc/gsc-pending-cookie';

const CSRF_COOKIE_MAX_AGE = 10 * 60;

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          try {
            const { authUrl, nonce, state } = buildAuthUrl({ workspaceId: auth.workspaceId });
            const response = apiSuccess({ authUrl, state });
            response.cookies.set({
              name: GSC_CSRF_COOKIE_NAME,
              value: nonce,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: CSRF_COOKIE_MAX_AGE,
            });
            return response;
          } catch (err) {
            if (err instanceof OAuthConfigError) {
              return apiError('GSC_OAUTH_NOT_CONFIGURED', err.message, 503);
            }
            throw err;
          }
        }, 'read-write')
      )
    )
  )
);
