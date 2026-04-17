// ---------------------------------------------------------------------------
// Google OAuth 2.0 — Search Console read-only access.
//
// Implements Authorization Code flow with a signed `state` parameter for CSRF
// protection. Uses the standard confidential-client flow (Quaynt is
// server-side, the client secret stays on the server).
//
// Scope requested: https://www.googleapis.com/auth/webmasters.readonly
// `access_type=offline` + `prompt=consent` guarantee a refresh token.
//
// No external OAuth library — direct fetch calls against Google's documented
// endpoints (Core Principle 1: lightweight dependencies).
// ---------------------------------------------------------------------------

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/config/env';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

export const GSC_OAUTH_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export class OAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthConfigError';
  }
}

export class OAuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthStateError';
  }
}

export class OAuthTokenError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'OAuthTokenError';
  }
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface RefreshedTokens {
  accessToken: string;
  expiresAt: Date;
  scope: string;
}

export interface OAuthState {
  workspaceId: string;
  nonce: string;
  issuedAt: number;
}

function getOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
    throw new OAuthConfigError(
      'Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.'
    );
  }
  return {
    clientId: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: GOOGLE_OAUTH_REDIRECT_URI,
  };
}

function getStateSecret(): string {
  // Reuse BETTER_AUTH_SECRET — we only need a server-side shared secret for the HMAC.
  return env.BETTER_AUTH_SECRET;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Buffer {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(str.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

export function signState(payload: OAuthState): string {
  const json = JSON.stringify(payload);
  const body = b64url(Buffer.from(json, 'utf8'));
  const hmac = createHmac('sha256', getStateSecret()).update(body).digest();
  return `${body}.${b64url(hmac)}`;
}

export function verifyState(state: string): OAuthState {
  const parts = state.split('.');
  if (parts.length !== 2) {
    throw new OAuthStateError('Malformed OAuth state');
  }
  const [body, sig] = parts;
  const expected = createHmac('sha256', getStateSecret()).update(body).digest();
  const provided = b64urlDecode(sig);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new OAuthStateError('OAuth state signature mismatch');
  }
  let parsed: OAuthState;
  try {
    parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as OAuthState;
  } catch {
    throw new OAuthStateError('OAuth state payload could not be parsed');
  }
  if (
    typeof parsed.workspaceId !== 'string' ||
    typeof parsed.nonce !== 'string' ||
    typeof parsed.issuedAt !== 'number'
  ) {
    throw new OAuthStateError('OAuth state payload missing required fields');
  }
  if (Date.now() - parsed.issuedAt > STATE_MAX_AGE_MS) {
    throw new OAuthStateError('OAuth state has expired');
  }
  return parsed;
}

export function buildAuthUrl(input: { workspaceId: string }): {
  authUrl: string;
  state: string;
  nonce: string;
} {
  const { clientId, redirectUri } = getOAuthConfig();
  const nonce = b64url(randomBytes(16));
  const state = signState({ workspaceId: input.workspaceId, nonce, issuedAt: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GSC_OAUTH_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });

  return {
    authUrl: `${AUTH_ENDPOINT}?${params.toString()}`,
    state,
    nonce,
  };
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

async function postForm(url: string, params: Record<string, string>): Promise<Response> {
  const body = new URLSearchParams(params).toString();
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const res = await postForm(TOKEN_ENDPOINT, {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new OAuthTokenError(
      `Google token exchange failed (${res.status}): ${body.slice(0, 200)}`,
      res.status
    );
  }

  const payload = (await res.json()) as GoogleTokenResponse;
  if (!payload.refresh_token) {
    throw new OAuthTokenError(
      'Google did not return a refresh token. This usually means the user has previously granted access — revoke at https://myaccount.google.com/permissions and retry.'
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000),
    scope: payload.scope,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
  const { clientId, clientSecret } = getOAuthConfig();

  const res = await postForm(TOKEN_ENDPOINT, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new OAuthTokenError(
      `Google token refresh failed (${res.status}): ${body.slice(0, 200)}`,
      res.status
    );
  }

  const payload = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000),
    scope: payload.scope,
  };
}

export interface GoogleSite {
  siteUrl: string;
  permissionLevel: string;
}

interface GoogleSitesResponse {
  siteEntry?: GoogleSite[];
}

/**
 * List the Search Console sites accessible by the bearer token.
 *
 * Used only during the OAuth connect flow to show the property picker.
 * Ongoing API calls from the main client go through `gsc-client.ts`.
 */
export async function listSitesForToken(accessToken: string): Promise<GoogleSite[]> {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new OAuthTokenError(
      `Google sites listing failed (${res.status}): ${body.slice(0, 200)}`,
      res.status
    );
  }

  const data = (await res.json()) as GoogleSitesResponse;
  return data.siteEntry ?? [];
}

export async function revokeToken(token: string): Promise<void> {
  const res = await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // Google returns 200 on success; 400 means already revoked — treat as success.
  if (!res.ok && res.status !== 400) {
    const body = await res.text().catch(() => '');
    throw new OAuthTokenError(
      `Google token revoke failed (${res.status}): ${body.slice(0, 200)}`,
      res.status
    );
  }
}
