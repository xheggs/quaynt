// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'test-secret-at-least-32-chars-long-aaaaaa',
    GOOGLE_OAUTH_CLIENT_ID: 'test-client-id',
    GOOGLE_OAUTH_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://example.test/callback',
  },
}));

describe('gsc-oauth.service — state signing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips a signed state', async () => {
    const { signState, verifyState } = await import('./gsc-oauth.service');
    const payload = { workspaceId: 'ws_test', nonce: 'abc123', issuedAt: Date.now() };
    const state = signState(payload);

    const decoded = verifyState(state);
    expect(decoded.workspaceId).toBe('ws_test');
    expect(decoded.nonce).toBe('abc123');
  });

  it('rejects a tampered state', async () => {
    const { signState, verifyState, OAuthStateError } = await import('./gsc-oauth.service');
    const state = signState({ workspaceId: 'ws_test', nonce: 'n', issuedAt: Date.now() });
    const [body, sig] = state.split('.');
    // Build a tampered body whose base64url decode still parses but yields a different payload.
    const tamperedPayload = Buffer.from(
      JSON.stringify({ workspaceId: 'ws_evil', nonce: 'n', issuedAt: Date.now() }),
      'utf8'
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const tampered = `${tamperedPayload}.${sig}`;
    void body; // body unused — we replace it entirely

    expect(() => verifyState(tampered)).toThrow(OAuthStateError);
  });

  it('rejects a malformed state', async () => {
    const { verifyState, OAuthStateError } = await import('./gsc-oauth.service');
    expect(() => verifyState('not-a-state')).toThrow(OAuthStateError);
  });

  it('rejects an expired state', async () => {
    const { signState, verifyState, OAuthStateError } = await import('./gsc-oauth.service');
    const state = signState({
      workspaceId: 'ws_test',
      nonce: 'n',
      issuedAt: Date.now() - 11 * 60 * 1000,
    });
    expect(() => verifyState(state)).toThrow(OAuthStateError);
  });
});

describe('gsc-oauth.service — buildAuthUrl', () => {
  it('produces a Google auth URL with required OAuth params', async () => {
    const { buildAuthUrl } = await import('./gsc-oauth.service');
    const { authUrl, nonce, state } = buildAuthUrl({ workspaceId: 'ws_test' });

    const u = new URL(authUrl);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('client_id')).toBe('test-client-id');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('prompt')).toBe('consent');
    expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/webmasters.readonly');
    expect(u.searchParams.get('state')).toBe(state);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('gsc-oauth.service — exchangeCodeForTokens', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns tokens from a successful exchange', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'ya29.test',
              refresh_token: '1//test-refresh',
              expires_in: 3600,
              scope: 'https://www.googleapis.com/auth/webmasters.readonly',
              token_type: 'Bearer',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
      )
    );

    const { exchangeCodeForTokens } = await import('./gsc-oauth.service');
    const tokens = await exchangeCodeForTokens('test-code');
    expect(tokens.accessToken).toBe('ya29.test');
    expect(tokens.refreshToken).toBe('1//test-refresh');
    expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('throws OAuthTokenError on non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('invalid_grant', { status: 400 }))
    );

    const { exchangeCodeForTokens, OAuthTokenError } = await import('./gsc-oauth.service');
    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow(OAuthTokenError);
  });

  it('throws when Google omits the refresh token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'ya29.test',
              expires_in: 3600,
              scope: 'https://www.googleapis.com/auth/webmasters.readonly',
              token_type: 'Bearer',
            }),
            { status: 200 }
          )
      )
    );

    const { exchangeCodeForTokens } = await import('./gsc-oauth.service');
    await expect(exchangeCodeForTokens('code')).rejects.toThrow(/refresh token/);
  });
});

describe('gsc-oauth.service — refreshAccessToken', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes an access token successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'ya29.new',
              expires_in: 3600,
              scope: 'https://www.googleapis.com/auth/webmasters.readonly',
              token_type: 'Bearer',
            }),
            { status: 200 }
          )
      )
    );

    const { refreshAccessToken } = await import('./gsc-oauth.service');
    const refreshed = await refreshAccessToken('1//refresh');
    expect(refreshed.accessToken).toBe('ya29.new');
  });

  it('propagates refresh failures as OAuthTokenError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('invalid_grant', { status: 400 }))
    );

    const { refreshAccessToken, OAuthTokenError } = await import('./gsc-oauth.service');
    await expect(refreshAccessToken('1//dead')).rejects.toThrow(OAuthTokenError);
  });
});

describe('gsc-oauth.service — revokeToken', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('succeeds on 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 200 }))
    );
    const { revokeToken } = await import('./gsc-oauth.service');
    await expect(revokeToken('test-token')).resolves.toBeUndefined();
  });

  it('treats 400 as already-revoked (success)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('invalid_token', { status: 400 }))
    );
    const { revokeToken } = await import('./gsc-oauth.service');
    await expect(revokeToken('dead-token')).resolves.toBeUndefined();
  });

  it('throws on 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('server error', { status: 500 }))
    );
    const { revokeToken, OAuthTokenError } = await import('./gsc-oauth.service');
    await expect(revokeToken('token')).rejects.toThrow(OAuthTokenError);
  });
});
