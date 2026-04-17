// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'test-secret-at-least-32-chars-long-aaaaaa',
    ADAPTER_ENCRYPTION_KEY: 'a'.repeat(64),
  },
}));

describe('gsc-pending-cookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('round-trips tokens through build + verify', async () => {
    const { buildPendingCookie, verifyPendingCookie } = await import('./gsc-pending-cookie');

    const cookie = buildPendingCookie({
      workspaceId: 'ws_test',
      accessToken: 'ya29.access',
      refreshToken: '1//refresh',
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      sites: [{ siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' }],
    });

    const verified = verifyPendingCookie(cookie);
    expect(verified.workspaceId).toBe('ws_test');
    expect(verified.accessToken).toBe('ya29.access');
    expect(verified.refreshToken).toBe('1//refresh');
    expect(verified.sites).toHaveLength(1);
    expect(verified.sites[0].siteUrl).toBe('https://example.com/');
  });

  it('rejects a tampered cookie', async () => {
    const { buildPendingCookie, verifyPendingCookie } = await import('./gsc-pending-cookie');

    const cookie = buildPendingCookie({
      workspaceId: 'ws_test',
      accessToken: 'a',
      refreshToken: 'r',
      tokenExpiresAt: new Date(Date.now() + 60_000),
      scope: 'x',
      sites: [],
    });

    const [body, sig] = cookie.split('.');
    const tamperedBody = Buffer.from(
      JSON.stringify({ workspaceId: 'ws_evil', issuedAt: Date.now() }),
      'utf8'
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const tampered = `${tamperedBody}.${sig}`;
    void body;

    expect(() => verifyPendingCookie(tampered)).toThrow();
  });
});
