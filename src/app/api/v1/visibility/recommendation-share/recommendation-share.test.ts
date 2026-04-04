// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetRecommendationShare = vi.fn();
const mockGetLatestRecommendationShare = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/visibility/recommendation-share.service', () => ({
  getRecommendationShare: (...args: unknown[]) => mockGetRecommendationShare(...args),
  getLatestRecommendationShare: (...args: unknown[]) => mockGetLatestRecommendationShare(...args),
  RECOMMENDATION_SHARE_ALLOWED_SORTS: ['periodStart', 'sharePercentage', 'citationCount'],
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

const sampleShareRow = {
  id: 'recshare_test1',
  workspaceId: 'ws_123',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  platformId: '_all',
  locale: '_all',
  periodStart: '2026-04-03',
  sharePercentage: '60.00',
  citationCount: 6,
  totalCitations: 10,
  modelRunCount: 2,
  createdAt: new Date('2026-04-03').toISOString(),
  updatedAt: new Date('2026-04-03').toISOString(),
};

describe('GET /api/v1/visibility/recommendation-share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecommendationShare.mockReset();
    mockGetLatestRecommendationShare.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with paginated recommendation share data', async () => {
    mockGetRecommendationShare.mockResolvedValueOnce({
      items: [sampleShareRow],
      total: 1,
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/recommendation-share?promptSetId=ps_test1'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toHaveLength(1);
    expect(body.data.meta).toEqual({ page: 1, limit: 25, total: 1 });
  });

  it('returns 400 when promptSetId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/recommendation-share');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('prompt set');
  });

  it('passes filter params to service', async () => {
    mockGetRecommendationShare.mockResolvedValueOnce({ items: [], total: 0 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/recommendation-share?promptSetId=ps_test1&brandId=brand_1&platformId=chatgpt'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetRecommendationShare).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({
        promptSetId: 'ps_test1',
        brandId: 'brand_1',
        platformId: 'chatgpt',
      }),
      expect.any(Object)
    );
  });

  it('supports day/week/month granularity', async () => {
    mockGetRecommendationShare.mockResolvedValueOnce({ items: [], total: 0 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/recommendation-share?promptSetId=ps_test1&granularity=week'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetRecommendationShare).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({ granularity: 'week' }),
      expect.any(Object)
    );
  });

  it('returns 400 for invalid granularity', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/recommendation-share?promptSetId=ps_test1&granularity=invalid'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    const { GET } = await import('./route');
    const req = new NextRequest(
      'http://localhost:3000/api/v1/visibility/recommendation-share?promptSetId=ps_test1',
      {
        method: 'GET',
      }
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('supports latest mode', async () => {
    mockGetLatestRecommendationShare.mockResolvedValueOnce([sampleShareRow]);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/recommendation-share?promptSetId=ps_test1&latest=true'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetLatestRecommendationShare).toHaveBeenCalledWith('ws_123', 'ps_test1', undefined);
  });

  it('includes rate limit headers', async () => {
    mockGetRecommendationShare.mockResolvedValueOnce({ items: [], total: 0 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/recommendation-share?promptSetId=ps_test1'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });
});
