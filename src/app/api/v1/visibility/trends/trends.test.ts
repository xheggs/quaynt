// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetTrends = vi.fn();
const mockVerifyApiKey = vi.fn();

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
  },
}));

vi.mock('@/modules/visibility/trend.service', () => ({
  getTrends: (...args: unknown[]) => mockGetTrends(...args),
}));

vi.mock('@/modules/brands/brand.schema', () => ({
  brand: { id: 'id', name: 'name', workspaceId: 'workspaceId', deletedAt: 'deletedAt' },
}));

vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: { id: 'id', name: 'name', workspaceId: 'workspaceId', deletedAt: 'deletedAt' },
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
    QUAYNT_EDITION: 'community',
  },
}));

const mockChildLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('@/lib/logger', () => ({
  logger: { child: () => mockChildLogger },
  setRequestLogger: vi.fn(),
  getRequestLogger: () => mockChildLogger,
}));

function createAuthedRequest(path: string): NextRequest {
  const headers = new Headers({
    authorization: 'Bearer qk_test_key_12345678901234567890',
  });
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

const sampleTrendResult = {
  metric: 'recommendation_share',
  brand: { brandId: 'brand_test', brandName: 'TestBrand' },
  market: { promptSetId: 'ps_test', name: 'TestMarket' },
  period: 'weekly',
  filters: { platformId: '_all', locale: '_all', from: '2026-03-02', to: '2026-03-15' },
  dataPoints: [
    {
      periodStart: '2026-03-02',
      periodEnd: '2026-03-08',
      value: '30',
      previousValue: null,
      delta: null,
      changeRate: null,
      direction: null,
      movingAverage: '30',
      dataPoints: 5,
    },
  ],
  summary: {
    latestValue: '30',
    latestDelta: null,
    latestDirection: null,
    overallDirection: null,
    overallChangeRate: null,
    periodCount: 1,
    dataPointCount: 5,
  },
};

function setupExistenceChecks(brandExists = true, promptSetExists = true) {
  let callCount = 0;
  mockSelect.mockImplementation(() => {
    callCount++;
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    if (callCount === 1) {
      mockLimit.mockResolvedValue(brandExists ? [{ id: 'brand_test' }] : []);
    } else {
      mockLimit.mockResolvedValue(promptSetExists ? [{ id: 'ps_test' }] : []);
    }
    return { from: mockFrom };
  });
}

describe('GET /api/v1/visibility/trends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with trend data', async () => {
    setupExistenceChecks();
    mockGetTrends.mockResolvedValueOnce(sampleTrendResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=recommendation_share&promptSetId=ps_test&brandId=brand_test'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.metric).toBe('recommendation_share');
    expect(body.data.dataPoints).toHaveLength(1);
    expect(body.data.summary.latestValue).toBe('30');
  });

  it('returns 400 when metric is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?promptSetId=ps_test&brandId=brand_test'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('metric');
  });

  it('returns 400 for invalid metric', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=invalid_metric&promptSetId=ps_test&brandId=brand_test'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('Invalid metric');
  });

  it('returns 400 when promptSetId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=recommendation_share&brandId=brand_test'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('promptSetId');
  });

  it('returns 400 when brandId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=recommendation_share&promptSetId=ps_test'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('brandId');
  });

  it('returns 400 for invalid period', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=recommendation_share&promptSetId=ps_test&brandId=brand_test&period=daily'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('weekly');
  });

  it('returns 400 for malformed date', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=recommendation_share&promptSetId=ps_test&brandId=brand_test&from=not-a-date'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('date');
  });

  it('returns 404 when brand not found', async () => {
    setupExistenceChecks(false, true);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=recommendation_share&promptSetId=ps_test&brandId=brand_missing'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain('Brand');
  });

  it('returns 404 when prompt set not found', async () => {
    setupExistenceChecks(true, false);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=recommendation_share&promptSetId=ps_missing&brandId=brand_test'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toContain('Prompt set');
  });

  it('returns 401 for unauthenticated request', async () => {
    const { GET } = await import('./route');
    const req = new NextRequest(
      'http://localhost:3000/api/v1/visibility/trends?metric=recommendation_share&promptSetId=ps_test&brandId=brand_test',
      { method: 'GET' }
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('forwards all params to getTrends', async () => {
    setupExistenceChecks();
    mockGetTrends.mockResolvedValueOnce(sampleTrendResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/trends?metric=sentiment&promptSetId=ps_test&brandId=brand_test&platformId=chatgpt&locale=en&period=monthly&from=2026-01-01&to=2026-03-31&includeMovingAverage=false'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetTrends).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({
        metric: 'sentiment',
        promptSetId: 'ps_test',
        brandId: 'brand_test',
        platformId: 'chatgpt',
        locale: 'en',
        period: 'monthly',
        from: '2026-01-01',
        to: '2026-03-31',
        includeMovingAverage: false,
      })
    );
  });
});
