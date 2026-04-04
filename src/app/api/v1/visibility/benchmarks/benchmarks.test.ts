// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetBenchmarks = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/visibility/benchmark.service', () => ({
  getBenchmarks: (...args: unknown[]) => mockGetBenchmarks(...args),
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

const sampleBenchmarkResult = {
  market: { promptSetId: 'ps_test1', name: 'Test Market' },
  period: {
    from: '2026-03-27',
    to: '2026-04-03',
    comparisonFrom: '2026-03-20',
    comparisonTo: '2026-03-26',
  },
  brands: [
    {
      brandId: 'brand_1',
      brandName: 'Acme',
      rank: 1,
      rankChange: null,
      recommendationShare: { current: '60.00', previous: null, delta: null, direction: null },
      citationCount: { current: 6, previous: null, delta: null },
      modelRunCount: 2,
    },
  ],
  meta: { totalBrands: 1, totalPrompts: 10, lastUpdatedAt: '2026-04-03T00:00:00.000Z' },
};

describe('GET /api/v1/visibility/benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBenchmarks.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with benchmark data for a market', async () => {
    mockGetBenchmarks.mockResolvedValueOnce(sampleBenchmarkResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/benchmarks?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.brands).toHaveLength(1);
    expect(body.data.market.promptSetId).toBe('ps_test1');
  });

  it('returns 400 when promptSetId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/benchmarks');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('prompt set');
  });

  it('passes filter params to service', async () => {
    mockGetBenchmarks.mockResolvedValueOnce(sampleBenchmarkResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/benchmarks?promptSetId=ps_test1&platformId=chatgpt&locale=en&from=2026-03-27&to=2026-04-03'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetBenchmarks).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({
        promptSetId: 'ps_test1',
        platformId: 'chatgpt',
        locale: 'en',
        from: '2026-03-27',
        to: '2026-04-03',
      })
    );
  });

  it('supports all comparison period options', async () => {
    mockGetBenchmarks.mockResolvedValueOnce(sampleBenchmarkResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/benchmarks?promptSetId=ps_test1&comparisonPeriod=previous_week'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetBenchmarks).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({ comparisonPeriod: 'previous_week' })
    );
  });

  it('returns 400 for invalid comparison period', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/benchmarks?promptSetId=ps_test1&comparisonPeriod=invalid'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    const { GET } = await import('./route');
    const req = new NextRequest(
      'http://localhost:3000/api/v1/visibility/benchmarks?promptSetId=ps_test1',
      {
        method: 'GET',
      }
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('parses comma-separated brandIds', async () => {
    mockGetBenchmarks.mockResolvedValueOnce(sampleBenchmarkResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/benchmarks?promptSetId=ps_test1&brandIds=b1,b2,b3'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetBenchmarks).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({ brandIds: ['b1', 'b2', 'b3'] })
    );
  });

  it('returns empty brands array when no data in market', async () => {
    mockGetBenchmarks.mockResolvedValueOnce({
      ...sampleBenchmarkResult,
      brands: [],
      meta: { totalBrands: 0, totalPrompts: 10, lastUpdatedAt: null },
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/benchmarks?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.brands).toEqual([]);
    expect(body.data.meta.totalBrands).toBe(0);
  });

  it('includes rate limit headers', async () => {
    mockGetBenchmarks.mockResolvedValueOnce(sampleBenchmarkResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/benchmarks?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });
});
