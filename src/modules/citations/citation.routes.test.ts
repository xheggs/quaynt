// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockListCitations = vi.fn();
const mockGetCitation = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/citations/citation.service', () => ({
  listCitations: (...args: unknown[]) => mockListCitations(...args),
  getCitation: (...args: unknown[]) => mockGetCitation(...args),
  CITATION_ALLOWED_SORTS: ['createdAt', 'position'],
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

const sampleCitation = {
  id: 'cit_test1',
  workspaceId: 'ws_123',
  brandId: 'brand_test1',
  modelRunId: 'run_test1',
  modelRunResultId: 'runres_test1',
  platformId: 'chatgpt',
  citationType: 'owned',
  position: 1,
  contextSnippet: 'Acme is great.',
  relevanceSignal: 'domain_match',
  sourceUrl: 'https://acme.com/page',
  title: 'Acme Page',
  createdAt: new Date('2026-04-03').toISOString(),
  updatedAt: new Date('2026-04-03').toISOString(),
};

describe('citation endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCitation.mockReset();
    mockListCitations.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  describe('GET /api/v1/citations', () => {
    it('returns paginated response with correct meta', async () => {
      mockListCitations.mockResolvedValueOnce({
        items: [sampleCitation],
        total: 1,
      });

      const { GET } = await import('@/app/api/v1/citations/route');
      const req = createAuthedRequest('GET', '/api/v1/citations');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.data).toHaveLength(1);
      expect(body.data.meta).toEqual({ page: 1, limit: 25, total: 1 });
    });

    it('passes filter params to service', async () => {
      mockListCitations.mockResolvedValueOnce({ items: [], total: 0 });

      const { GET } = await import('@/app/api/v1/citations/route');
      const req = createAuthedRequest(
        'GET',
        '/api/v1/citations?brandId=brand_1&citationType=owned'
      );
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      expect(mockListCitations).toHaveBeenCalledWith(
        'ws_123',
        expect.objectContaining({ brandId: 'brand_1', citationType: 'owned' }),
        expect.any(Object)
      );
    });

    it('returns 400 for invalid citationType', async () => {
      const { GET } = await import('@/app/api/v1/citations/route');
      const req = createAuthedRequest('GET', '/api/v1/citations?citationType=invalid');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(400);
    });

    it('returns 401 for unauthenticated request', async () => {
      const { GET } = await import('@/app/api/v1/citations/route');
      const req = new NextRequest('http://localhost:3000/api/v1/citations', {
        method: 'GET',
      });
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/citations/:citationId', () => {
    it('returns single citation', async () => {
      mockGetCitation.mockResolvedValueOnce(sampleCitation);

      const { GET } = await import('@/app/api/v1/citations/[citationId]/route');
      const req = createAuthedRequest('GET', '/api/v1/citations/cit_test1');
      const res = await GET(req, { params: Promise.resolve({ citationId: 'cit_test1' }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe('cit_test1');
    });

    it('returns 404 for nonexistent citation', async () => {
      mockGetCitation.mockRejectedValueOnce(new Error('Citation not found'));

      const { GET } = await import('@/app/api/v1/citations/[citationId]/route');
      const req = createAuthedRequest('GET', '/api/v1/citations/cit_missing');
      const res = await GET(req, { params: Promise.resolve({ citationId: 'cit_missing' }) });

      expect(res.status).toBe(404);
    });
  });
});
