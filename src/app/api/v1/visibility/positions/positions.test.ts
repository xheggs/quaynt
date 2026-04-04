// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetPositionAggregates = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/visibility/position-aggregate.service', () => ({
  getPositionAggregates: (...args: unknown[]) => mockGetPositionAggregates(...args),
  POSITION_AGGREGATE_ALLOWED_SORTS: [
    'periodStart',
    'averagePosition',
    'medianPosition',
    'firstMentionRate',
    'topThreeRate',
    'citationCount',
  ],
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

const sampleRow = {
  id: 'posagg_test1',
  workspaceId: 'ws_123',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  platformId: '_all',
  locale: '_all',
  periodStart: '2026-04-03',
  citationCount: 10,
  averagePosition: '2.35',
  medianPosition: '2.00',
  minPosition: 1,
  maxPosition: 5,
  firstMentionCount: 4,
  firstMentionRate: '40.00',
  topThreeCount: 8,
  topThreeRate: '80.00',
  positionDistribution: { '1': 4, '2': 2, '3': 2, '4': 1, '5': 1 },
  modelRunCount: 3,
  createdAt: new Date('2026-04-03'),
  updatedAt: new Date('2026-04-03'),
};

const sampleSummary = {
  totalCitations: 10,
  overallAveragePosition: '2.35',
  overallFirstMentionRate: '40.00',
  overallTopThreeRate: '80.00',
  brandsTracked: 1,
};

const sampleServiceResult = {
  items: [sampleRow],
  total: 1,
  summary: sampleSummary,
};

describe('GET /api/v1/visibility/positions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPositionAggregates.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with position data and summary', async () => {
    mockGetPositionAggregates.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/positions?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toHaveLength(1);
    expect(body.data.data[0].averagePosition).toBe('2.35');
    expect(body.data.summary.totalCitations).toBe(10);
    expect(body.data.meta.total).toBe(1);
  });

  it('returns 400 when promptSetId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/positions');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('prompt set');
  });

  it('passes filter params to service', async () => {
    mockGetPositionAggregates.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/positions?promptSetId=ps_test1&brandId=brand_test1&platformId=chatgpt&locale=en&from=2026-04-01&to=2026-04-03&granularity=week'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetPositionAggregates).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({
        promptSetId: 'ps_test1',
        brandId: 'brand_test1',
        platformId: 'chatgpt',
        locale: 'en',
        from: '2026-04-01',
        to: '2026-04-03',
        granularity: 'week',
      }),
      expect.objectContaining({ page: 1, limit: 25 })
    );
  });

  it('returns 200 with empty data when no positions', async () => {
    mockGetPositionAggregates.mockResolvedValueOnce({
      items: [],
      total: 0,
      summary: {
        totalCitations: 0,
        overallAveragePosition: '0.00',
        overallFirstMentionRate: '0.00',
        overallTopThreeRate: '0.00',
        brandsTracked: 0,
      },
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/positions?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toHaveLength(0);
    expect(body.data.summary.totalCitations).toBe(0);
  });

  it('returns 401 for unauthenticated request', async () => {
    const { GET } = await import('./route');
    const req = new NextRequest(
      'http://localhost:3000/api/v1/visibility/positions?promptSetId=ps_test1',
      { method: 'GET' }
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('includes rate limit headers', async () => {
    mockGetPositionAggregates.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/positions?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });

  it('includes summary in response', async () => {
    mockGetPositionAggregates.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/positions?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    const body = await res.json();
    expect(body.data.summary).toEqual(sampleSummary);
  });

  it('includes pagination meta in response', async () => {
    mockGetPositionAggregates.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/positions?promptSetId=ps_test1&page=2&limit=10'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    const body = await res.json();
    expect(body.data.meta.page).toBe(2);
    expect(body.data.meta.limit).toBe(10);
  });

  it('includes position distribution in response', async () => {
    mockGetPositionAggregates.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/positions?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    const body = await res.json();
    expect(body.data.data[0].positionDistribution).toEqual({
      '1': 4,
      '2': 2,
      '3': 2,
      '4': 1,
      '5': 1,
    });
  });
});
