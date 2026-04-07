// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetReportData = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/reports/report-data.service', () => ({
  getReportData: (...args: unknown[]) => mockGetReportData(...args),
}));

vi.mock('@/modules/reports/report-data.types', () => ({
  VALID_REPORT_METRICS: [
    'recommendation_share',
    'citation_count',
    'sentiment',
    'positions',
    'sources',
    'opportunities',
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

function createAuthedRequest(path: string): NextRequest {
  const headers = new Headers({
    authorization: 'Bearer qk_test_key_12345678901234567890',
  });
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

function createUnauthenticatedRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET' });
}

const sampleReportResult = {
  market: { promptSetId: 'ps_test', name: 'Test Market' },
  period: {
    from: '2026-03-01',
    to: '2026-03-31',
    comparisonFrom: '2026-01-29',
    comparisonTo: '2026-02-28',
  },
  filters: { platformId: '_all', locale: '_all' },
  brands: [
    {
      brand: { brandId: 'brand_1', brandName: 'Acme' },
      metrics: {
        recommendationShare: {
          current: '50.00',
          previous: '40.00',
          delta: '10.00',
          changeRate: '25.00',
          direction: 'up',
          sparkline: [{ date: '2026-03-01', value: '50.00' }],
        },
      },
    },
  ],
};

const basePath = '/api/v1/reports/data';

describe('GET /api/v1/reports/data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReportData.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with full report data', async () => {
    mockGetReportData.mockResolvedValueOnce(sampleReportResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandId=brand_1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.brands).toHaveLength(1);
    expect(body.data.market.promptSetId).toBe('ps_test');
    expect(body.data.brands[0].metrics.recommendationShare.current).toBe('50.00');
  });

  it('returns 400 when promptSetId missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?brandId=brand_1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('prompt set');
  });

  it('returns 400 when neither brandId nor brandIds provided', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('brand');
  });

  it('returns 400 when both brandId and brandIds provided', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandId=b1&brandIds=b2,b3`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('either');
  });

  it('returns 400 when brandIds exceeds 25 entries', async () => {
    const brands = Array.from({ length: 26 }, (_, i) => `b${i}`).join(',');
    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandIds=${brands}`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('25');
  });

  it('returns 400 for invalid metric name in metrics param', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?promptSetId=ps_test&brandId=b1&metrics=invalid_metric`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('Invalid metric');
    expect(body.error.message).toContain('invalid_metric');
  });

  it('filters by specific metrics (only returns requested blocks)', async () => {
    mockGetReportData.mockResolvedValueOnce(sampleReportResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?promptSetId=ps_test&brandId=b1&metrics=recommendation_share,sentiment`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetReportData).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({
        metrics: ['recommendation_share', 'sentiment'],
      })
    );
  });

  it('supports single brandId', async () => {
    mockGetReportData.mockResolvedValueOnce(sampleReportResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandId=brand_1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetReportData).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({ brandId: 'brand_1', brandIds: undefined })
    );
  });

  it('supports comma-separated brandIds', async () => {
    mockGetReportData.mockResolvedValueOnce(sampleReportResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandIds=b1,b2,b3`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetReportData).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({ brandIds: ['b1', 'b2', 'b3'], brandId: undefined })
    );
  });

  it('supports all comparison period options', async () => {
    mockGetReportData.mockResolvedValueOnce(sampleReportResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?promptSetId=ps_test&brandId=b1&comparisonPeriod=previous_month`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetReportData).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({ comparisonPeriod: 'previous_month' })
    );
  });

  it('filters by platformId and locale', async () => {
    mockGetReportData.mockResolvedValueOnce(sampleReportResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?promptSetId=ps_test&brandId=b1&platformId=chatgpt&locale=en-US`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetReportData).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({ platformId: 'chatgpt', locale: 'en-US' })
    );
  });

  it('requires authentication (401 without auth)', async () => {
    const { GET } = await import('./route');
    const req = createUnauthenticatedRequest(`${basePath}?promptSetId=ps_test&brandId=b1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('requires read scope (403 without scope)', async () => {
    mockVerifyApiKey.mockResolvedValueOnce({
      id: 'key_no_scope',
      workspaceId: 'ws_123',
      scopes: '',
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandId=b1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(403);
  });

  it('rate limit headers present', async () => {
    mockGetReportData.mockResolvedValueOnce(sampleReportResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandId=b1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
  });

  it('request ID header present', async () => {
    mockGetReportData.mockResolvedValueOnce(sampleReportResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandId=b1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-Request-Id')).toBeDefined();
  });

  it('returns 200 with empty brands when no data in market', async () => {
    mockGetReportData.mockResolvedValueOnce({
      ...sampleReportResult,
      brands: [],
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandId=b_unknown`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.brands).toHaveLength(0);
  });

  it('returns 200 with empty brands when all requested brandIds are unknown', async () => {
    mockGetReportData.mockResolvedValueOnce({
      ...sampleReportResult,
      brands: [],
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandIds=unknown1,unknown2`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.brands).toEqual([]);
  });

  it('warnings array present when a metric fetcher fails partially', async () => {
    mockGetReportData.mockResolvedValueOnce({
      ...sampleReportResult,
      warnings: ['sentiment: DB connection failed'],
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=ps_test&brandId=b1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.warnings).toContain('sentiment: DB connection failed');
  });
});
