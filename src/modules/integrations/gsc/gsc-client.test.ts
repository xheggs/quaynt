// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'test-secret-at-least-32-chars-long-aaaaaa',
    ADAPTER_ENCRYPTION_KEY: 'a'.repeat(64),
    GOOGLE_OAUTH_CLIENT_ID: 'cid',
    GOOGLE_OAUTH_CLIENT_SECRET: 'csecret',
    GOOGLE_OAUTH_REDIRECT_URI: 'https://example.test/cb',
  },
}));

const mockConnection = {
  id: 'gscconn_test',
  workspaceId: 'ws_test',
  propertyUrl: 'https://example.com/',
  accessToken: 'ya29.current',
  refreshToken: '1//refresh',
  tokenExpiresAt: new Date(Date.now() + 3_600_000),
  scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  status: 'active' as const,
};

const connectionMock = {
  getConnectionWithTokens: vi.fn(),
  updateAccessToken: vi.fn(),
  updateConnectionStatus: vi.fn(),
};

vi.mock('./gsc-connection.service', () => ({
  getConnectionWithTokens: (...args: unknown[]) => connectionMock.getConnectionWithTokens(...args),
  updateAccessToken: (...args: unknown[]) => connectionMock.updateAccessToken(...args),
  updateConnectionStatus: (...args: unknown[]) => connectionMock.updateConnectionStatus(...args),
}));

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('gsc-client', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    connectionMock.getConnectionWithTokens.mockReset().mockResolvedValue({ ...mockConnection });
    connectionMock.updateAccessToken.mockReset().mockResolvedValue(undefined);
    connectionMock.updateConnectionStatus.mockReset().mockResolvedValue(undefined);
    const mod = await import('./gsc-client');
    mod.__resetClientCaches();
  });

  it('returns parsed rows on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          rows: [
            {
              keys: ['2026-04-15', 'query one', '/p'],
              clicks: 5,
              impressions: 100,
              ctr: 0.05,
              position: 3.2,
            },
          ],
          responseAggregationType: 'byPage',
        })
      )
    );

    const { searchAnalyticsQuery } = await import('./gsc-client');
    const res = await searchAnalyticsQuery('gscconn_test', {
      startDate: '2026-04-01',
      endDate: '2026-04-15',
      dimensions: ['date', 'query', 'page'],
      rowLimit: 25000,
    });

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].clicks).toBe(5);
  });

  it('refreshes access token after a 401 and retries', async () => {
    // First call: 401. Refresh call: 200. Second call: 200 with data.
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 })) // search #1
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'ya29.new',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/webmasters.readonly',
          token_type: 'Bearer',
        })
      ) // refresh
      .mockResolvedValueOnce(jsonResponse({ rows: [] })); // search #2

    vi.stubGlobal('fetch', fetchMock);

    const { searchAnalyticsQuery } = await import('./gsc-client');
    const res = await searchAnalyticsQuery('gscconn_test', {
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });

    expect(res.rows).toEqual([]);
    expect(connectionMock.updateAccessToken).toHaveBeenCalled();
  });

  it('marks connection forbidden on 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Forbidden', { status: 403 }))
    );

    const { searchAnalyticsQuery, GscForbiddenError } = await import('./gsc-client');
    await expect(
      searchAnalyticsQuery('gscconn_test', { startDate: '2026-04-01', endDate: '2026-04-15' })
    ).rejects.toThrow(GscForbiddenError);

    expect(connectionMock.updateConnectionStatus).toHaveBeenCalledWith(
      'gscconn_test',
      'forbidden',
      expect.any(String)
    );
  });

  it('retries a 5xx response and succeeds on second attempt', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ rows: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const { searchAnalyticsQuery } = await import('./gsc-client');
    const res = await searchAnalyticsQuery('gscconn_test', {
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });
    expect(res.rows).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws GscRateLimitedError after exhausting 429 retries', async () => {
    // Note: Retry-After=0 + 3 attempts = fast test.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('rate limited', { status: 429, headers: { 'Retry-After': '0' } })
      )
    );

    const { searchAnalyticsQuery, GscRateLimitedError } = await import('./gsc-client');
    await expect(
      searchAnalyticsQuery('gscconn_test', { startDate: '2026-04-01', endDate: '2026-04-15' })
    ).rejects.toThrow(GscRateLimitedError);
  }, 10_000);

  it('marks connection reauth_required when refresh fails', async () => {
    // Use a connection with an already-expired access token so ensureFreshAccessToken
    // refreshes BEFORE the search call, and the refresh fails.
    const expired = { ...mockConnection, tokenExpiresAt: new Date(Date.now() - 1000) };
    connectionMock.getConnectionWithTokens.mockResolvedValue(expired);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('invalid_grant', { status: 400 }))
    );

    const { searchAnalyticsQuery, GscReauthRequiredError } = await import('./gsc-client');
    await expect(
      searchAnalyticsQuery('gscconn_test', { startDate: '2026-04-01', endDate: '2026-04-15' })
    ).rejects.toThrow(GscReauthRequiredError);

    expect(connectionMock.updateConnectionStatus).toHaveBeenCalledWith(
      'gscconn_test',
      'reauth_required',
      expect.any(String)
    );
  });

  it('rate-limits when the per-connection bucket is exhausted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ rows: [] }))
    );

    const { searchAnalyticsQuery, GscRateLimitedError, __resetClientCaches } =
      await import('./gsc-client');
    __resetClientCaches();

    // Run 60 calls in a tight loop. The per-connection bucket is 25 QPM, and
    // the refill-per-elapsed-ms is tiny in test execution time, so we expect
    // most calls beyond ~25 to reject. We assert at least one rate-limit.
    let rateLimited = 0;
    for (let i = 0; i < 60; i++) {
      try {
        await searchAnalyticsQuery('gscconn_test', {
          startDate: '2026-04-01',
          endDate: '2026-04-15',
        });
      } catch (err) {
        if (err instanceof GscRateLimitedError) rateLimited++;
        else throw err;
      }
    }
    expect(rateLimited).toBeGreaterThan(0);
  });

  it('listSites returns siteEntry on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          siteEntry: [{ siteUrl: 'https://a.com/', permissionLevel: 'siteOwner' }],
        })
      )
    );

    const { listSites } = await import('./gsc-client');
    const sites = await listSites('gscconn_test');
    expect(sites).toHaveLength(1);
    expect(sites[0].siteUrl).toBe('https://a.com/');
  });
});
