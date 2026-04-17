// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getMock = vi.fn();
vi.mock('@/modules/integrations/gsc-correlation/gsc-correlation.service', () => ({
  getCorrelationSummary: (...a: unknown[]) => getMock(...a),
}));

vi.mock('@/modules/workspace/api-key.service', () => ({
  verifyApiKey: vi.fn().mockResolvedValue({ id: 'key_1', workspaceId: 'ws_A', scopes: 'read' }),
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

function req(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: 'Bearer qk_testkey_1234567890' },
  });
}

describe('GET /api/v1/traffic/gsc/correlation/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with summary data', async () => {
    getMock.mockResolvedValue({
      aiCitedClicks: 10,
      aiCitedImpressions: 100,
      avgPosition: 2.5,
      distinctQueries: 2,
      gapQueries: 1,
    });

    const { GET } = await import('./route');
    const res = await GET(
      req('http://localhost/api/v1/traffic/gsc/correlation/summary?from=2026-04-01&to=2026-04-15'),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.aiCitedClicks).toBe(10);
    expect(getMock).toHaveBeenCalledWith(
      'ws_A',
      expect.objectContaining({
        from: '2026-04-01',
        to: '2026-04-15',
      })
    );
  });

  it('rejects ranges longer than 90 days', async () => {
    const { GET } = await import('./route');
    const res = await GET(
      req('http://localhost/api/v1/traffic/gsc/correlation/summary?from=2025-01-01&to=2026-04-15'),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid date formats', async () => {
    const { GET } = await import('./route');
    const res = await GET(
      req('http://localhost/api/v1/traffic/gsc/correlation/summary?from=bad-date&to=2026-04-15'),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(400);
  });
});
