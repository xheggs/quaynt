// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const clientMock = {
  searchAnalyticsQuery: vi.fn(),
};
const connMock = {
  getConnectionPublic: vi.fn(),
  updateSyncResult: vi.fn(),
  updateConnectionStatus: vi.fn(),
};
const insertedBatches: unknown[][] = [];

vi.mock('@/modules/integrations/gsc/gsc-client', async () => {
  const actual = await vi.importActual<typeof import('@/modules/integrations/gsc/gsc-client')>(
    '@/modules/integrations/gsc/gsc-client'
  );
  return {
    ...actual,
    searchAnalyticsQuery: (...a: unknown[]) => clientMock.searchAnalyticsQuery(...a),
  };
});

vi.mock('@/modules/integrations/gsc/gsc-connection.service', () => ({
  getConnectionPublic: (...a: unknown[]) => connMock.getConnectionPublic(...a),
  updateSyncResult: (...a: unknown[]) => connMock.updateSyncResult(...a),
  updateConnectionStatus: (...a: unknown[]) => connMock.updateConnectionStatus(...a),
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: () => ({
      values: (rows: unknown[]) => ({
        onConflictDoUpdate: () => {
          insertedBatches.push(rows);
          return Promise.resolve();
        },
      }),
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}));

describe('gsc-sync.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedBatches.length = 0;
    connMock.getConnectionPublic.mockResolvedValue({
      id: 'gscconn_1',
      workspaceId: 'ws_A',
      propertyUrl: 'https://example.com/',
      scope: 'x',
      status: 'active',
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
    });
    connMock.updateSyncResult.mockResolvedValue(undefined);
    connMock.updateConnectionStatus.mockResolvedValue(undefined);
  });

  it('imports a single page of rows and marks completed', async () => {
    clientMock.searchAnalyticsQuery.mockResolvedValueOnce({
      rows: [
        { keys: ['2026-04-15', 'q1', '/a'], clicks: 3, impressions: 40, ctr: 0.075, position: 2.1 },
        { keys: ['2026-04-15', 'q2', '/b'], clicks: 1, impressions: 12, ctr: 0.083, position: 7.5 },
      ],
    });

    const { syncProperty } = await import('./gsc-sync.service');
    const result = await syncProperty({ workspaceId: 'ws_A', gscConnectionId: 'gscconn_1' });

    expect(result.rowsImported).toBe(2);
    expect(result.status).toBe('completed');
    expect(insertedBatches).toHaveLength(1);
    expect(connMock.updateSyncResult).toHaveBeenCalledWith('gscconn_1', 'completed');
  });

  it('paginates when GSC returns a full page', async () => {
    const fullPage = Array.from({ length: 25_000 }, (_, i) => ({
      keys: ['2026-04-15', `q${i}`, '/p'],
      clicks: 1,
      impressions: 10,
      ctr: 0.1,
      position: 5.0,
    }));
    clientMock.searchAnalyticsQuery
      .mockResolvedValueOnce({ rows: fullPage })
      .mockResolvedValueOnce({ rows: [] });

    const { syncProperty } = await import('./gsc-sync.service');
    const result = await syncProperty({ workspaceId: 'ws_A', gscConnectionId: 'gscconn_1' });

    expect(result.rowsImported).toBe(25_000);
    expect(clientMock.searchAnalyticsQuery).toHaveBeenCalledTimes(2);
  });

  it('skips rows missing any keys', async () => {
    clientMock.searchAnalyticsQuery.mockResolvedValueOnce({
      rows: [
        { keys: ['2026-04-15', 'q1', '/a'], clicks: 1, impressions: 1, ctr: 1, position: 1 },
        { keys: ['', 'q2', '/b'], clicks: 1, impressions: 1, ctr: 1, position: 1 }, // bad
      ],
    });

    const { syncProperty } = await import('./gsc-sync.service');
    const result = await syncProperty({ workspaceId: 'ws_A', gscConnectionId: 'gscconn_1' });

    expect(result.rowsImported).toBe(1);
  });

  it('marks throttled on GscRateLimitedError', async () => {
    const { GscRateLimitedError } = await import('@/modules/integrations/gsc/gsc-client');
    clientMock.searchAnalyticsQuery.mockRejectedValueOnce(new GscRateLimitedError(60));

    const { syncProperty } = await import('./gsc-sync.service');
    await expect(
      syncProperty({ workspaceId: 'ws_A', gscConnectionId: 'gscconn_1' })
    ).rejects.toBeInstanceOf(GscRateLimitedError);

    expect(connMock.updateSyncResult).toHaveBeenCalledWith(
      'gscconn_1',
      'throttled',
      expect.any(String)
    );
  });

  it('marks reauth_required on GscReauthRequiredError', async () => {
    const { GscReauthRequiredError } = await import('@/modules/integrations/gsc/gsc-client');
    clientMock.searchAnalyticsQuery.mockRejectedValueOnce(new GscReauthRequiredError());

    const { syncProperty } = await import('./gsc-sync.service');
    await expect(
      syncProperty({ workspaceId: 'ws_A', gscConnectionId: 'gscconn_1' })
    ).rejects.toBeInstanceOf(GscReauthRequiredError);

    expect(connMock.updateSyncResult).toHaveBeenCalledWith(
      'gscconn_1',
      'failed',
      expect.stringContaining('Reauthorization')
    );
  });

  it('marks forbidden on GscForbiddenError', async () => {
    const { GscForbiddenError } = await import('@/modules/integrations/gsc/gsc-client');
    clientMock.searchAnalyticsQuery.mockRejectedValueOnce(new GscForbiddenError());

    const { syncProperty } = await import('./gsc-sync.service');
    await expect(
      syncProperty({ workspaceId: 'ws_A', gscConnectionId: 'gscconn_1' })
    ).rejects.toBeInstanceOf(GscForbiddenError);

    expect(connMock.updateConnectionStatus).toHaveBeenCalledWith(
      'gscconn_1',
      'forbidden',
      expect.any(String)
    );
  });
});
