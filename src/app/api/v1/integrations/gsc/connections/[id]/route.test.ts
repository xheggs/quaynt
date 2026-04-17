// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const deleteMock = vi.fn();
vi.mock('@/modules/integrations/gsc/gsc-connection.service', () => ({
  deleteConnection: (...a: unknown[]) => deleteMock(...a),
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

function authedReq(method: string, url: string): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { authorization: 'Bearer qk_testkey_1234567890' },
  });
}

describe('DELETE /api/v1/integrations/gsc/connections/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 204 when deletion succeeds', async () => {
    deleteMock.mockResolvedValue(true);
    const { DELETE } = await import('./route');
    const req = authedReq(
      'DELETE',
      'http://localhost/api/v1/integrations/gsc/connections/gscconn_1'
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: 'gscconn_1' }) });
    expect(res.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith('ws_A', 'gscconn_1');
  });

  it('returns 404 when connection not found', async () => {
    deleteMock.mockResolvedValue(false);
    const { DELETE } = await import('./route');
    const req = authedReq(
      'DELETE',
      'http://localhost/api/v1/integrations/gsc/connections/gscconn_missing'
    );
    const res = await DELETE(req, { params: Promise.resolve({ id: 'gscconn_missing' }) });
    expect(res.status).toBe(404);
  });

  it('isolates by workspaceId', async () => {
    deleteMock.mockResolvedValue(false);
    const { DELETE } = await import('./route');
    const req = authedReq(
      'DELETE',
      'http://localhost/api/v1/integrations/gsc/connections/gscconn_foreign'
    );
    await DELETE(req, { params: Promise.resolve({ id: 'gscconn_foreign' }) });
    // Service call must receive the authenticated workspace, not the requested connection's workspace.
    expect(deleteMock).toHaveBeenCalledWith('ws_A', 'gscconn_foreign');
  });
});
