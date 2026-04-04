// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetSentimentAggregates = vi.fn();
const mockGetLatestSentiment = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/visibility/sentiment-aggregate.service', () => ({
  getSentimentAggregates: (...args: unknown[]) => mockGetSentimentAggregates(...args),
  getLatestSentiment: (...args: unknown[]) => mockGetLatestSentiment(...args),
  SENTIMENT_AGGREGATE_ALLOWED_SORTS: [
    'periodStart',
    'netSentimentScore',
    'positivePercentage',
    'negativePercentage',
    'totalCount',
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

const sampleSentimentRow = {
  id: 'sentagg_test1',
  workspaceId: 'ws_123',
  brandId: 'brand_test1',
  promptSetId: 'ps_test1',
  platformId: '_all',
  locale: '_all',
  periodStart: '2026-04-03',
  positiveCount: 3,
  neutralCount: 1,
  negativeCount: 1,
  totalCount: 5,
  positivePercentage: '60.00',
  neutralPercentage: '20.00',
  negativePercentage: '20.00',
  netSentimentScore: '40.00',
  averageScore: '0.1000',
  modelRunCount: 2,
  createdAt: new Date('2026-04-03').toISOString(),
  updatedAt: new Date('2026-04-03').toISOString(),
};

describe('GET /api/v1/visibility/sentiment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSentimentAggregates.mockReset();
    mockGetLatestSentiment.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with paginated sentiment aggregate data', async () => {
    mockGetSentimentAggregates.mockResolvedValueOnce({
      items: [sampleSentimentRow],
      total: 1,
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/sentiment?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toHaveLength(1);
    expect(body.data.meta).toEqual({ page: 1, limit: 25, total: 1 });
  });

  it('returns 400 when promptSetId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/sentiment');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('prompt set');
  });

  it('passes filter params to service', async () => {
    mockGetSentimentAggregates.mockResolvedValueOnce({ items: [], total: 0 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/sentiment?promptSetId=ps_test1&brandId=brand_1&platformId=chatgpt'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetSentimentAggregates).toHaveBeenCalledWith(
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
    mockGetSentimentAggregates.mockResolvedValueOnce({ items: [], total: 0 });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/sentiment?promptSetId=ps_test1&granularity=month'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetSentimentAggregates).toHaveBeenCalledWith(
      'ws_123',
      expect.objectContaining({ granularity: 'month' }),
      expect.any(Object)
    );
  });

  it('supports latest mode', async () => {
    mockGetLatestSentiment.mockResolvedValueOnce([sampleSentimentRow]);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      'GET',
      '/api/v1/visibility/sentiment?promptSetId=ps_test1&latest=true'
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetLatestSentiment).toHaveBeenCalledWith('ws_123', 'ps_test1', undefined);
  });

  it('returns 401 for unauthenticated request', async () => {
    const { GET } = await import('./route');
    const req = new NextRequest(
      'http://localhost:3000/api/v1/visibility/sentiment?promptSetId=ps_test1',
      {
        method: 'GET',
      }
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('includes rate limit headers', async () => {
    mockGetSentimentAggregates.mockResolvedValueOnce({ items: [], total: 0 });

    const { GET } = await import('./route');
    const req = createAuthedRequest('GET', '/api/v1/visibility/sentiment?promptSetId=ps_test1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });
});
