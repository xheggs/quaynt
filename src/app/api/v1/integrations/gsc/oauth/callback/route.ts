// ---------------------------------------------------------------------------
// GET /api/v1/integrations/gsc/oauth/callback
//
// Called by Google as the OAuth 2.0 redirect target. Verifies the signed
// `state` parameter and the CSRF cookie nonce, exchanges the auth code for
// tokens, fetches the accessible Search Console sites, stashes everything in
// a short-lived signed cookie, and redirects the user back to
// /settings/integrations/gsc where they pick a property.
//
// This route is session-authenticated (users complete OAuth in a browser).
// It does not use the API rate limiter — the flow is inherently
// user-interactive and low-throughput.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuth, getAuthContext } from '@/lib/api/middleware';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import {
  exchangeCodeForTokens,
  listSitesForToken,
  verifyState,
  OAuthConfigError,
  OAuthStateError,
  OAuthTokenError,
} from '@/modules/integrations/gsc/gsc-oauth.service';
import {
  buildPendingCookie,
  GSC_CSRF_COOKIE_NAME,
  GSC_PENDING_COOKIE_NAME,
  PENDING_COOKIE_MAX_AGE_SECONDS,
} from '@/modules/integrations/gsc/gsc-pending-cookie';
import { getRequestLogger } from '@/lib/logger';

function settingsRedirect(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/settings/integrations/gsc', req.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = NextResponse.redirect(url);
  // Clear the CSRF cookie after single use.
  response.cookies.set({ name: GSC_CSRF_COOKIE_NAME, value: '', path: '/', maxAge: 0 });
  return response;
}

export const GET = withRequestId(
  withRequestLog(
    withAuth(async (req) => {
      const log = getRequestLogger(req);
      const auth = getAuthContext(req);

      const code = req.nextUrl.searchParams.get('code');
      const state = req.nextUrl.searchParams.get('state');
      const oauthError = req.nextUrl.searchParams.get('error');

      if (oauthError) {
        log.info({ oauthError }, '[gsc-oauth] User cancelled or denied OAuth consent');
        return settingsRedirect(req, { status: 'cancelled' });
      }
      if (!code || !state) {
        return settingsRedirect(req, { status: 'error', reason: 'missing_params' });
      }

      let decodedState;
      try {
        decodedState = verifyState(state);
      } catch (err) {
        log.warn({ err }, '[gsc-oauth] State verification failed');
        return settingsRedirect(req, { status: 'error', reason: 'state_invalid' });
      }

      if (decodedState.workspaceId !== auth.workspaceId) {
        log.warn('[gsc-oauth] State workspaceId does not match session workspace');
        return settingsRedirect(req, { status: 'error', reason: 'workspace_mismatch' });
      }

      const csrfCookie = req.cookies.get(GSC_CSRF_COOKIE_NAME)?.value;
      if (!csrfCookie || csrfCookie !== decodedState.nonce) {
        log.warn('[gsc-oauth] CSRF cookie nonce mismatch');
        return settingsRedirect(req, { status: 'error', reason: 'csrf_mismatch' });
      }

      try {
        const tokens = await exchangeCodeForTokens(code);
        const sites = await listSitesForToken(tokens.accessToken);

        const pendingCookie = buildPendingCookie({
          workspaceId: auth.workspaceId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          scope: tokens.scope,
          sites,
        });

        const response = settingsRedirect(req, { status: 'pending' });
        response.cookies.set({
          name: GSC_PENDING_COOKIE_NAME,
          value: pendingCookie,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: PENDING_COOKIE_MAX_AGE_SECONDS,
        });
        return response;
      } catch (err) {
        if (err instanceof OAuthConfigError) {
          return settingsRedirect(req, { status: 'error', reason: 'not_configured' });
        }
        if (err instanceof OAuthTokenError) {
          log.warn(
            { err: err.message, statusCode: err.statusCode },
            '[gsc-oauth] Token exchange failed'
          );
          return settingsRedirect(req, { status: 'error', reason: 'token_exchange_failed' });
        }
        if (err instanceof OAuthStateError) {
          return settingsRedirect(req, { status: 'error', reason: 'state_invalid' });
        }
        log.error({ err }, '[gsc-oauth] Unexpected error during callback');
        return settingsRedirect(req, { status: 'error', reason: 'unknown' });
      }
    })
  )
);
