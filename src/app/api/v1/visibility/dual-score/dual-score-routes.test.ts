// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockVerifyApiKey = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

const mockGetDualScore = vi.fn();
const mockGetDualHistory = vi.fn();
const mockGetDualQueries = vi.fn();
const mockGetCombinedRecommendations = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: (...a: unknown[]) => mockSelect(...a),
  },
}));

vi.mock('@/modules/visibility/dual-score.service', () => ({
  getDualScore: (...args: unknown[]) => mockGetDualScore(...args),
  getDualHistory: (...args: unknown[]) => mockGetDualHistory(...args),
  getDualQueries: (...args: unknown[]) => mockGetDualQueries(...args),
  getCombinedRecommendations: (...args: unknown[]) => mockGetCombinedRecommendations(...args),
}));

vi.mock('@/modules/visibility/seo-score.inputs', () => ({
  lastCompletePeriod: () => ({ periodStart: '2026-03-01', periodEnd: '2026-03-31' }),
}));

vi.mock('@/modules/brands/brand.schema', () => ({
  brand: { id: 'id', workspaceId: 'workspaceId' },
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

function authedRequest(path: string): NextRequest {
  const headers = new Headers({
    authorization: 'Bearer qk_test_key_00000000000000000000',
  });
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

function unauthedRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET' });
}

function mockBrandFound(found: boolean): void {
  mockSelect.mockImplementation(() => {
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue(found ? [{ id: 'brand_a' }] : []);
    return { from: mockFrom };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyApiKey.mockResolvedValue({
    id: 'key_a',
    workspaceId: 'ws_a',
    scopes: 'read',
  });
});

describe('GET /api/v1/visibility/dual-score', () => {
  it('returns 401 without an authorization header', async () => {
    const { GET } = await import('./route');
    const res = await GET(unauthedRequest('/api/v1/visibility/dual-score?brandId=brand_a'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when brandId is missing', async () => {
    const { GET } = await import('./route');
    const res = await GET(authedRequest('/api/v1/visibility/dual-score'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the brand is not in the authenticated workspace', async () => {
    mockBrandFound(false);
    const { GET } = await import('./route');
    const res = await GET(authedRequest('/api/v1/visibility/dual-score?brandId=brand_other'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 with the dual-score payload', async () => {
    mockBrandFound(true);
    mockGetDualScore.mockResolvedValue({
      workspaceId: 'ws_a',
      brandId: 'brand_a',
      at: '2026-04-15',
      granularity: 'monthly',
      seo: null,
      geo: null,
      correlation: {
        rho: null,
        label: 'insufficientData',
        direction: null,
        n: 0,
        code: 'insufficientData',
        window: { from: '2025-11-01', to: '2026-04-01' },
      },
      dataQualityAdvisories: [],
      codes: ['NO_SEO_SNAPSHOTS', 'NO_GEO_SNAPSHOTS', 'NO_SNAPSHOTS', 'INSUFFICIENT_WINDOW'],
    });
    const { GET } = await import('./route');
    const res = await GET(
      authedRequest(
        '/api/v1/visibility/dual-score?brandId=brand_a&granularity=monthly&at=2026-04-15'
      ),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.codes)).toBe(true);
    expect(body.data.correlation.label).toBe('insufficientData');
    expect(mockGetDualScore).toHaveBeenCalledWith('ws_a', 'brand_a', '2026-04-15', 'monthly');
  });
});

describe('GET /api/v1/visibility/dual-score/history', () => {
  it('returns 400 when from > to', async () => {
    const { GET } = await import('./history/route');
    const res = await GET(
      authedRequest(
        '/api/v1/visibility/dual-score/history?brandId=brand_a&from=2026-04-01&to=2026-01-01'
      ),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with aligned pairs', async () => {
    mockBrandFound(true);
    mockGetDualHistory.mockResolvedValue({
      pairs: [
        {
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          seo: 40,
          geo: 60,
          seoDelta: null,
          geoDelta: null,
        },
      ],
      granularity: 'monthly',
      formulaVersionChanges: [],
    });
    const { GET } = await import('./history/route');
    const res = await GET(
      authedRequest(
        '/api/v1/visibility/dual-score/history?brandId=brand_a&from=2026-01-01&to=2026-04-01'
      ),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pairs).toHaveLength(1);
  });
});

describe('GET /api/v1/visibility/dual-score/queries', () => {
  it('rejects limit > 100', async () => {
    const { GET } = await import('./queries/route');
    const res = await GET(
      authedRequest(
        '/api/v1/visibility/dual-score/queries?brandId=brand_a&from=2026-01-01&to=2026-04-01&limit=250'
      ),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(400);
  });

  it('rejects an unknown gap-signal value', async () => {
    const { GET } = await import('./queries/route');
    const res = await GET(
      authedRequest(
        '/api/v1/visibility/dual-score/queries?brandId=brand_a&from=2026-01-01&to=2026-04-01&gapSignal=purple'
      ),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 with paginated rows', async () => {
    mockBrandFound(true);
    mockGetDualQueries.mockResolvedValue({
      rows: [
        {
          query: 'best running shoes',
          impressions: 500,
          clicks: 40,
          ctr: 0.08,
          avgPosition: 3.2,
          aioCitationCount: 5,
          aioFirstSeenAt: null,
          brandMentionRate: 0.4,
          avgBrandPosition: 2,
          netSentimentScore: 0.3,
          gapSignal: 'balanced',
        },
      ],
      page: 1,
      limit: 20,
      totalRows: 1,
      totalPages: 1,
    });
    const { GET } = await import('./queries/route');
    const res = await GET(
      authedRequest(
        '/api/v1/visibility/dual-score/queries?brandId=brand_a&from=2026-01-01&to=2026-04-01&gapSignal=balanced'
      ),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rows).toHaveLength(1);
    expect(body.data.rows[0].gapSignal).toBe('balanced');
  });
});

describe('GET /api/v1/visibility/dual-score/recommendations', () => {
  it('returns 200 with a merged list', async () => {
    mockBrandFound(true);
    mockGetCombinedRecommendations.mockResolvedValue({
      recommendations: [
        {
          source: 'geo',
          factorId: 'citation_frequency',
          severity: 'high',
          titleKey: 'rec.citation_frequency.title',
          descriptionKey: 'rec.citation_frequency.description',
          estimatedPointDelta: 10,
        },
      ],
      partial: false,
      failedSource: null,
    });
    const { GET } = await import('./recommendations/route');
    const res = await GET(
      authedRequest('/api/v1/visibility/dual-score/recommendations?brandId=brand_a'),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.recommendations).toHaveLength(1);
    expect(body.data.partial).toBe(false);
  });

  it('returns 200 with partial=true when one side throws within the service', async () => {
    mockBrandFound(true);
    mockGetCombinedRecommendations.mockResolvedValue({
      recommendations: [
        {
          source: 'seo',
          factorId: 'impression_volume',
          severity: 'medium',
          titleKey: 'rec.impression_volume.title',
          descriptionKey: 'rec.impression_volume.description',
          estimatedPointDelta: 5,
        },
      ],
      partial: true,
      failedSource: 'geo',
    });
    const { GET } = await import('./recommendations/route');
    const res = await GET(
      authedRequest('/api/v1/visibility/dual-score/recommendations?brandId=brand_a'),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.partial).toBe(true);
    expect(body.data.failedSource).toBe('geo');
  });

  it('returns 500 when the combined-recommendations service throws (both sides failed)', async () => {
    mockBrandFound(true);
    mockGetCombinedRecommendations.mockRejectedValue(new Error('both failed'));
    const { GET } = await import('./recommendations/route');
    const res = await GET(
      authedRequest('/api/v1/visibility/dual-score/recommendations?brandId=brand_a'),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(500);
  });
});
