// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const serviceMocks = {
  listConnections: vi.fn(),
  createConnection: vi.fn(),
};

const pendingMocks = {
  verifyPendingCookie: vi.fn(),
};

vi.mock('@/modules/integrations/gsc/gsc-connection.service', () => ({
  listConnections: (...a: unknown[]) => serviceMocks.listConnections(...a),
  createConnection: (...a: unknown[]) => serviceMocks.createConnection(...a),
}));

vi.mock('@/modules/integrations/gsc/gsc-pending-cookie', () => ({
  GSC_PENDING_COOKIE_NAME: 'quaynt_gsc_pending',
  verifyPendingCookie: (...a: unknown[]) => pendingMocks.verifyPendingCookie(...a),
}));

vi.mock('@/modules/workspace/api-key.service', () => ({
  verifyApiKey: vi
    .fn()
    .mockResolvedValue({ id: 'key_1', workspaceId: 'ws_A', scopes: 'read-write' }),
}));

vi.mock('@/modules/workspace/workspace.service', () => ({
  resolveWorkspace: vi.fn(),
  getUserWorkspaces: vi.fn(),
  createWorkspaceForUser: vi.fn(),
  generateWorkspaceSlug: vi.fn(),
}));

vi.mock('@/modules/auth/auth.config', () => ({
  getAuth: () => ({ api: { getSession: vi.fn().mockResolvedValue(null) } }),
}));

vi.mock('rate-limiter-flexible', () => {
  class RateLimiterPostgres {
    consume() {
      return Promise.resolve({ remainingPoints: 99, msBeforeNext: 60000 });
    }
  }
  class RateLimiterRes {}
  return { RateLimiterPostgres, RateLimiterRes };
});

vi.mock('@/lib/db/pool', () => ({ pool: {} }));

vi.mock('@/lib/config/env', () => ({
  env: { RATE_LIMIT_POINTS: 100, RATE_LIMIT_DURATION: 60, CORS_ALLOWED_ORIGINS: '*' },
}));

const childLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock('@/lib/logger', () => ({
  logger: { child: () => childLog },
  setRequestLogger: vi.fn(),
  getRequestLogger: () => childLog,
}));

function authedReq(
  method: string,
  url: string,
  opts: { body?: unknown; cookie?: string } = {}
): NextRequest {
  const headers = new Headers({ authorization: 'Bearer qk_testkey_1234567890' });
  if (opts.cookie) headers.set('cookie', opts.cookie);
  if (opts.body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('GET /api/v1/integrations/gsc/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with connection list', async () => {
    serviceMocks.listConnections.mockResolvedValue([
      {
        id: 'gscconn_1',
        workspaceId: 'ws_A',
        propertyUrl: 'https://example.com/',
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
        status: 'active',
        connectedAt: new Date(),
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      },
    ]);

    const { GET } = await import('./route');
    const req = authedReq('GET', 'http://localhost/api/v1/integrations/gsc/connections');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.connections).toHaveLength(1);
    expect(body.data.connections[0]).not.toHaveProperty('accessToken');
    expect(body.data.connections[0]).not.toHaveProperty('refreshToken');
  });

  it('scopes to authenticated workspace', async () => {
    serviceMocks.listConnections.mockResolvedValue([]);
    const { GET } = await import('./route');
    const req = authedReq('GET', 'http://localhost/api/v1/integrations/gsc/connections');
    await GET(req, { params: Promise.resolve({}) });
    expect(serviceMocks.listConnections).toHaveBeenCalledWith('ws_A');
  });
});

describe('POST /api/v1/integrations/gsc/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no pending cookie is present', async () => {
    const { POST } = await import('./route');
    const req = authedReq('POST', 'http://localhost/api/v1/integrations/gsc/connections', {
      body: { propertyUrl: 'https://example.com/' },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when pending cookie is invalid', async () => {
    pendingMocks.verifyPendingCookie.mockImplementation(() => {
      throw new Error('bad');
    });
    const { POST } = await import('./route');
    const req = authedReq('POST', 'http://localhost/api/v1/integrations/gsc/connections', {
      body: { propertyUrl: 'https://example.com/' },
      cookie: 'quaynt_gsc_pending=abc.def',
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when pending cookie is for a different workspace', async () => {
    pendingMocks.verifyPendingCookie.mockReturnValue({
      workspaceId: 'ws_B',
      accessToken: 'a',
      refreshToken: 'r',
      tokenExpiresAt: new Date(),
      scope: 'x',
      sites: [{ siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' }],
    });
    const { POST } = await import('./route');
    const req = authedReq('POST', 'http://localhost/api/v1/integrations/gsc/connections', {
      body: { propertyUrl: 'https://example.com/' },
      cookie: 'quaynt_gsc_pending=abc.def',
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns 422 when chosen property is not in the pending site list', async () => {
    pendingMocks.verifyPendingCookie.mockReturnValue({
      workspaceId: 'ws_A',
      accessToken: 'a',
      refreshToken: 'r',
      tokenExpiresAt: new Date(),
      scope: 'x',
      sites: [{ siteUrl: 'https://other.com/', permissionLevel: 'siteOwner' }],
    });
    const { POST } = await import('./route');
    const req = authedReq('POST', 'http://localhost/api/v1/integrations/gsc/connections', {
      body: { propertyUrl: 'https://example.com/' },
      cookie: 'quaynt_gsc_pending=abc.def',
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
  });

  it('creates a connection and returns 201 on success', async () => {
    pendingMocks.verifyPendingCookie.mockReturnValue({
      workspaceId: 'ws_A',
      accessToken: 'ya29.test',
      refreshToken: '1//test',
      tokenExpiresAt: new Date(Date.now() + 3600000),
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      sites: [{ siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' }],
    });
    serviceMocks.createConnection.mockResolvedValue({
      id: 'gscconn_new',
      workspaceId: 'ws_A',
      propertyUrl: 'https://example.com/',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      status: 'active',
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
    });

    const { POST } = await import('./route');
    const req = authedReq('POST', 'http://localhost/api/v1/integrations/gsc/connections', {
      body: { propertyUrl: 'https://example.com/' },
      cookie: 'quaynt_gsc_pending=abc.def',
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.connection.id).toBe('gscconn_new');
    expect(body.data.connection).not.toHaveProperty('accessToken');
  });
});
