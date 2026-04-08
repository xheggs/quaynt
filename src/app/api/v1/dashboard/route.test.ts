// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetDashboardData = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/dashboard/dashboard.service', () => ({
  getDashboardData: (...args: unknown[]) => mockGetDashboardData(...args),
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

const sampleDashboardResult = {
  kpis: {
    recommendationShare: {
      current: '45.00',
      previous: '40.00',
      delta: '5.00',
      changeRate: '12.50',
      direction: 'up',
      sparkline: [{ date: '2026-03-15', value: '45.00' }],
    },
    totalCitations: {
      current: '150',
      previous: '135',
      delta: '15.00',
      changeRate: '11.11',
      direction: 'up',
      sparkline: [{ date: '2026-03-15', value: '150' }],
    },
    averageSentiment: {
      current: '26.67',
      previous: '23.00',
      delta: '3.67',
      changeRate: '15.94',
      direction: 'up',
      sparkline: [{ date: '2026-03-15', value: '26.67' }],
    },
  },
  movers: [
    {
      brandId: 'brand_1',
      brandName: 'Brand One',
      metric: 'recommendation_share',
      current: '40.00',
      previous: '35.00',
      delta: '5.00',
      direction: 'up',
    },
  ],
  opportunities: [
    {
      brandId: 'brand_1',
      brandName: 'Brand One',
      query: 'Best CRM software?',
      type: 'missing',
      competitorCount: 5,
    },
  ],
  platforms: [
    {
      adapterId: 'adapter_1',
      platformId: 'chatgpt',
      displayName: 'ChatGPT',
      enabled: true,
      lastHealthStatus: 'healthy',
      lastHealthCheckedAt: '2026-04-01T12:00:00.000Z',
    },
  ],
  alerts: {
    active: 3,
    total: 10,
    bySeverity: { info: 2, warning: 5, critical: 3 },
    recentEvents: [],
  },
  dataAsOf: '2026-04-07T08:00:00.000Z',
  promptSet: { id: 'ps_1', name: 'Main Market' },
  period: { from: '2026-03-01', to: '2026-03-31' },
};

const basePath = '/api/v1/dashboard';

describe('GET /api/v1/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDashboardData.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with full dashboard data and no query params', async () => {
    mockGetDashboardData.mockResolvedValueOnce(sampleDashboardResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(basePath);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.kpis).toBeDefined();
    expect(body.data.movers).toBeDefined();
    expect(body.data.opportunities).toBeDefined();
    expect(body.data.platforms).toBeDefined();
    expect(body.data.alerts).toBeDefined();
    expect(body.data.promptSet.id).toBe('ps_1');
    expect(body.data.dataAsOf).toBeDefined();
  });

  it('passes optional filters to service', async () => {
    mockGetDashboardData.mockResolvedValueOnce(sampleDashboardResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?promptSetId=ps_custom&from=2026-02-01&to=2026-02-28`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(mockGetDashboardData).toHaveBeenCalledWith('ws_123', {
      promptSetId: 'ps_custom',
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('returns 400 for invalid date format', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?from=not-a-date`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('date');
  });

  it('returns 400 when from > to', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?from=2026-04-01&to=2026-03-01`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('before');
  });

  it('returns 401 without authentication', async () => {
    const { GET } = await import('./route');
    const req = createUnauthenticatedRequest(basePath);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('returns 400 for PROMPT_SET_NOT_FOUND error', async () => {
    const err = new Error('PROMPT_SET_NOT_FOUND');
    (err as Error & { code: string }).code = 'PROMPT_SET_NOT_FOUND';
    mockGetDashboardData.mockRejectedValueOnce(err);

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?promptSetId=nonexistent`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('Prompt set not found');
  });

  it('returns 503 when all sections fail', async () => {
    const err = new Error('ALL_SECTIONS_FAILED');
    (err as Error & { code: string; warnings: string[] }).code = 'ALL_SECTIONS_FAILED';
    (err as Error & { code: string; warnings: string[] }).warnings = [
      'Could not load kpis data',
      'Could not load movers data',
    ];
    mockGetDashboardData.mockRejectedValueOnce(err);

    const { GET } = await import('./route');
    const req = createAuthedRequest(basePath);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error.details.warnings).toHaveLength(2);
  });

  it('response includes warnings when present', async () => {
    mockGetDashboardData.mockResolvedValueOnce({
      ...sampleDashboardResult,
      platforms: null,
      warnings: ['Could not load platforms data'],
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(basePath);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.warnings).toContain('Could not load platforms data');
    expect(body.data.platforms).toBeNull();
  });

  it('request ID header is present', async () => {
    mockGetDashboardData.mockResolvedValueOnce(sampleDashboardResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(basePath);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-Request-Id')).toBeDefined();
  });

  it('rate limit headers are present', async () => {
    mockGetDashboardData.mockResolvedValueOnce(sampleDashboardResult);

    const { GET } = await import('./route');
    const req = createAuthedRequest(basePath);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
  });
});
