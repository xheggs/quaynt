// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetFanoutByModelRun = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/query-fanout/query-fanout.service', () => ({
  getFanoutByModelRun: (...args: unknown[]) => mockGetFanoutByModelRun(...args),
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

const sampleTree = {
  modelRunResultId: 'runres_1',
  platformId: 'gemini',
  promptId: 'prompt_1',
  promptText: 'Prompt text',
  rootMetadata: { groundingAttribution: 'root-only' },
  subQueries: [
    {
      id: 'qfn_sub1',
      text: 'sub a',
      metadata: null,
      sources: [],
    },
  ],
  rootSources: [{ id: 'qfn_src1', url: 'https://a.com', title: 'A', citationId: 'cit_a' }],
};

describe('GET /api/v1/visibility/query-fanout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFanoutByModelRun.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with fan-out trees and meta totals', async () => {
    mockGetFanoutByModelRun.mockResolvedValueOnce([sampleTree]);

    const { GET } = await import('./route');
    const req = createAuthedRequest('/api/v1/visibility/query-fanout?modelRunId=run_1');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toHaveLength(1);
    expect(body.data.meta).toEqual({
      totalResults: 1,
      totalSubQueries: 1,
      totalSimulatedSubQueries: 0,
      totalSources: 1,
    });
  });

  it('returns 400 when modelRunId is missing', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest('/api/v1/visibility/query-fanout');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('modelRunId');
  });

  it('passes filter params to service', async () => {
    mockGetFanoutByModelRun.mockResolvedValueOnce([]);

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      '/api/v1/visibility/query-fanout?modelRunId=run_1&platformId=gemini&promptId=prompt_1'
    );
    await GET(req, { params: Promise.resolve({}) });

    expect(mockGetFanoutByModelRun).toHaveBeenCalledWith(
      'ws_123',
      'run_1',
      expect.objectContaining({ platformId: 'gemini', promptId: 'prompt_1' })
    );
  });

  it('returns 401 for unauthenticated requests', async () => {
    const { GET } = await import('./route');
    const req = new NextRequest(
      'http://localhost:3000/api/v1/visibility/query-fanout?modelRunId=run_1',
      { method: 'GET' }
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('returns empty data (not 403) when cross-workspace has no results', async () => {
    mockGetFanoutByModelRun.mockResolvedValueOnce([]);
    const { GET } = await import('./route');
    const req = createAuthedRequest('/api/v1/visibility/query-fanout?modelRunId=run_other_ws');
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.data).toEqual([]);
  });
});
