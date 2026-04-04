// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetPresenceMatrix = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/visibility/benchmark.service', () => ({
  getPresenceMatrix: (...args: unknown[]) => mockGetPresenceMatrix(...args),
  BENCHMARK_ALLOWED_SORTS: ['rank', 'recommendationShare', 'citationCount', 'brandName'],
}));

vi.mock('@/modules/workspace/api-key.service', () => ({
  verifyApiKey: (...args: unknown[]) => mockVerifyApiKey(...args),
}));

vi.mock('@/modules/workspace/workspace.service', () => ({
  resolveWorkspace: vi.fn(),
  getUserWorkspaces: vi.fn(),
  createWorkspaceForUser: vi.fn(),
  generateWorkspaceSlug: vi.fn(),
}));

vi.mock('@/modules/auth/auth.config', () => ({
  getAuth: () => ({
    api: { getSession: vi.fn().mockResolvedValue(null) },
  }),
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
  env: {
    RATE_LIMIT_POINTS: 100,
    RATE_LIMIT_DURATION: 60,
    CORS_ALLOWED_ORIGINS: '*',
  },
}));

const mockChildLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@/lib/logger', () => ({
  logger: { child: () => mockChildLogger },
  setRequestLogger: vi.fn(),
  getRequestLogger: () => mockChildLogger,
}));

function createAuthedRequest(method: string, path: string): NextRequest {
  const headers = new Headers({
    authorization: 'Bearer qk_test_key_12345678901234567890',
  });
  return new NextRequest(`http://localhost:3000${path}`, { method, headers });
}

const samplePresenceRows = [
  {
    promptId: 'p1',
    promptText: 'Best hotel?',
    brands: [
      { brandId: 'b1', brandName: 'Hilton', present: true, citationCount: 5 },
      { brandId: 'b2', brandName: 'Marriott', present: true, citationCount: 3 },
    ],
  },
];

describe('GET /api/v1/visibility/benchmarks/presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPresenceMatrix.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with presence matrix data', async () => {
    mockGetPresenceMatrix.mockResolvedValueOnce({ rows: samplePresenceRows, total: 1 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/benchmarks/presence?promptSetId=ps_test1'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toHaveLength(1);
    expect(body.data.data[0].promptId).toBe('p1');
    expect(body.data.meta).toEqual({ page: 1, limit: 25, total: 1 });
  });

  it('returns 400 when promptSetId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/benchmarks/presence');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('prompt set');
  });

  it('passes filters to service', async () => {
    mockGetPresenceMatrix.mockResolvedValueOnce({ rows: [], total: 0 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/benchmarks/presence?promptSetId=ps_test1&brandIds=b1,b2&platformId=chatgpt&from=2026-03-27&to=2026-04-03'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetPresenceMatrix).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({
        promptSetId: 'ps_test1',
        brandIds: ['b1', 'b2'],
        platformId: 'chatgpt',
        from: '2026-03-27',
        to: '2026-04-03',
      }),
      expect.objectContaining({ page: 1, limit: 25 })
    );
  });

  it('pagination params are forwarded', async () => {
    mockGetPresenceMatrix.mockResolvedValueOnce({ rows: [], total: 50 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/benchmarks/presence?promptSetId=ps_test1&page=3&limit=10'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetPresenceMatrix).toHaveBeenCalledWith(
      'ws_123',
      expect.any(Object),
      expect.objectContaining({ page: 3, limit: 10 })
    );
    const body = await res.json();
    expect(body.data.meta.page).toBe(3);
    expect(body.data.meta.limit).toBe(10);
  });

  it('returns 401 for unauthenticated request', async () => {
    const { GET } = await import('./route');
    const req = new NextRequest(
      'http://localhost:3000/api/v1/visibility/benchmarks/presence?promptSetId=ps_test1',
      {
        method: 'GET',
      }
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('returns empty data when no presence data exists', async () => {
    mockGetPresenceMatrix.mockResolvedValueOnce({ rows: [], total: 0 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/benchmarks/presence?promptSetId=ps_test1'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toEqual([]);
    expect(body.data.meta.total).toBe(0);
  });
});
