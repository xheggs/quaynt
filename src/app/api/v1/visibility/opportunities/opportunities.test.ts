// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetOpportunities = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/visibility/opportunity.service', () => ({
  getOpportunities: (...args: unknown[]) => mockGetOpportunities(...args),
  OPPORTUNITY_ALLOWED_SORTS: ['score', 'competitorCount', 'platformCount', 'type', 'periodStart'],
}));

vi.mock('@/modules/visibility/opportunity.types', () => ({}));

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

const sampleOpportunity = {
  id: 'opp_test1',
  workspaceId: 'ws_123',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  promptId: 'prompt_test1',
  promptText: 'Best project management tools',
  periodStart: '2026-04-03',
  type: 'missing',
  score: '65.00',
  competitorCount: 3,
  totalTrackedBrands: 5,
  platformCount: 2,
  brandCitationCount: 0,
  competitors: [{ brandId: 'brand_b', brandName: 'Brand B', citationCount: 5 }],
  platformBreakdown: [{ platformId: 'chatgpt', brandGapOnPlatform: true, competitorCount: 3 }],
  createdAt: new Date('2026-04-03'),
  updatedAt: new Date('2026-04-03'),
};

const sampleSummary = {
  totalOpportunities: 1,
  missingCount: 1,
  weakCount: 0,
  averageScore: '65.00',
};

const sampleServiceResult = {
  items: [sampleOpportunity],
  total: 1,
  summary: sampleSummary,
};

describe('GET /api/v1/visibility/opportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOpportunities.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with opportunity data', async () => {
    mockGetOpportunities.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/opportunities?promptSetId=ps_test1&brandId=brand_test1'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toHaveLength(1);
    expect(body.data.data[0].type).toBe('missing');
    expect(body.data.summary.totalOpportunities).toBe(1);
    expect(body.data.meta.total).toBe(1);
  });

  it('returns 400 when promptSetId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/opportunities?brandId=brand_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('prompt set');
  });

  it('returns 400 when brandId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/opportunities?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('brand');
  });

  it('passes filter params to service', async () => {
    mockGetOpportunities.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/opportunities?promptSetId=ps_test1&brandId=brand_test1&type=missing&minCompetitorCount=3&platformId=chatgpt&from=2026-04-01&to=2026-04-03'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetOpportunities).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({
        promptSetId: 'ps_test1',
        brandId: 'brand_test1',
        type: 'missing',
        minCompetitorCount: 3,
        platformId: 'chatgpt',
        from: '2026-04-01',
        to: '2026-04-03',
      }),
      expect.objectContaining({ page: 1, limit: 25 })
    );
  });

  it('returns 200 with empty data when no opportunities', async () => {
    mockGetOpportunities.mockResolvedValueOnce({
      items: [],
      total: 0,
      summary: { totalOpportunities: 0, missingCount: 0, weakCount: 0, averageScore: '0.00' },
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/opportunities?promptSetId=ps_test1&brandId=brand_test1'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toHaveLength(0);
    expect(body.data.summary.totalOpportunities).toBe(0);
  });

  it('returns 401 for unauthenticated request', async () => {
    const { GET } = await import('./route');
    const req = new NextRequest(
      'http://localhost:3000/api/v1/visibility/opportunities?promptSetId=ps_test1&brandId=brand_test1',
      { method: 'GET' }
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('includes rate limit headers', async () => {
    mockGetOpportunities.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/opportunities?promptSetId=ps_test1&brandId=brand_test1'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });

  it('includes summary in response', async () => {
    mockGetOpportunities.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/opportunities?promptSetId=ps_test1&brandId=brand_test1'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    const body = await res.json();
    expect(body.data.summary).toEqual(sampleSummary);
  });

  it('includes pagination meta in response', async () => {
    mockGetOpportunities.mockResolvedValueOnce(sampleServiceResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/opportunities?promptSetId=ps_test1&brandId=brand_test1&page=2&limit=10'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    const body = await res.json();
    expect(body.data.meta.page).toBe(2);
    expect(body.data.meta.limit).toBe(10);
  });
});
