// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindCached = vi.fn();
const mockFindInFlight = vi.fn();
const mockCreatePending = vi.fn();
const mockGetById = vi.fn();
const mockGetOnboarding = vi.fn();
const mockBossSend = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/onboarding/onboarding-suggest.service', () => ({
  findRecentCachedSuggestion: (...args: unknown[]) => mockFindCached(...args),
  findInFlightSuggestion: (...args: unknown[]) => mockFindInFlight(...args),
  createPendingSuggestion: (...args: unknown[]) => mockCreatePending(...args),
  getSuggestionById: (...args: unknown[]) => mockGetById(...args),
}));

vi.mock('@/modules/onboarding/onboarding.service', () => ({
  getByWorkspace: (...args: unknown[]) => mockGetOnboarding(...args),
  initialize: vi.fn(),
  update: vi.fn(),
  markMilestone: vi.fn(),
  dismiss: vi.fn(),
  complete: vi.fn(),
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

type LimiterOverride = (() => Promise<{ remainingPoints: number; msBeforeNext: number }>) | null;
let consumeOverride: LimiterOverride = null;
vi.mock('rate-limiter-flexible', () => {
  class RateLimiterPostgres {
    async consume() {
      if (consumeOverride) return consumeOverride();
      return { remainingPoints: 99, msBeforeNext: 60000 };
    }
  }
  class RateLimiterRes {
    msBeforeNext = 60000;
  }
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

const mockChildLogger: {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  child: () => typeof mockChildLogger;
} = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: () => mockChildLogger,
};
vi.mock('@/lib/logger', () => ({
  logger: { child: () => mockChildLogger },
  setRequestLogger: vi.fn(),
  getRequestLogger: () => mockChildLogger,
}));

vi.mock('@/lib/jobs/boss', () => ({
  createBoss: () => ({ send: (...args: unknown[]) => mockBossSend(...args) }),
}));

function authedPost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/onboarding/suggest', {
    method: 'POST',
    headers: {
      authorization: 'Bearer qk_test_key_12345678901234567890',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

const baseRow = {
  id: 'onbsug_1',
  workspaceId: 'ws_123',
  domain: 'example.com',
  status: 'pending' as const,
  error: null,
  extracted: null,
  suggestedCompetitors: null,
  suggestedPrompts: null,
  suggestedAliases: null,
  engineUsed: null,
  completedAt: null,
  createdAt: new Date('2026-04-26T10:00:00Z'),
  updatedAt: new Date('2026-04-26T10:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  consumeOverride = null;
  mockVerifyApiKey.mockResolvedValue({
    id: 'key_auth',
    workspaceId: 'ws_123',
    scopes: 'read-write',
  });
  mockGetOnboarding.mockResolvedValue({
    workspaceId: 'ws_123',
    roleHint: 'seo',
    step: 'welcome',
    milestones: {},
    resultsViewed: false,
    activeRunId: null,
    completedAt: null,
    dismissedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    id: 'onb_1',
  });
});

describe('POST /api/v1/onboarding/suggest', () => {
  it('rejects an invalid domain with 400', async () => {
    const { POST } = await import('./route');
    const res = await POST(authedPost({ domain: '127.0.0.1' }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.details.code).toBe('is_ip');
  });

  it('returns cached: true when a recent done row exists', async () => {
    mockFindCached.mockResolvedValueOnce({ ...baseRow, status: 'done' });
    const { POST } = await import('./route');
    const res = await POST(authedPost({ domain: 'example.com' }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.cached).toBe(true);
    expect(body.data.inFlight).toBe(false);
    expect(mockCreatePending).not.toHaveBeenCalled();
    expect(mockBossSend).not.toHaveBeenCalled();
  });

  it('returns inFlight: true when a pending row exists', async () => {
    mockFindCached.mockResolvedValueOnce(null);
    mockFindInFlight.mockResolvedValueOnce({ ...baseRow, status: 'fetching' });
    const { POST } = await import('./route');
    const res = await POST(authedPost({ domain: 'example.com' }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.cached).toBe(false);
    expect(body.data.inFlight).toBe(true);
    expect(mockCreatePending).not.toHaveBeenCalled();
    expect(mockBossSend).not.toHaveBeenCalled();
  });

  it('creates a new pending row and enqueues a job when nothing cached', async () => {
    mockFindCached.mockResolvedValueOnce(null);
    mockFindInFlight.mockResolvedValueOnce(null);
    mockCreatePending.mockResolvedValueOnce(baseRow);
    const { POST } = await import('./route');
    const res = await POST(authedPost({ domain: 'https://EXAMPLE.com/about' }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.cached).toBe(false);
    expect(body.data.inFlight).toBe(false);
    expect(body.data.id).toBe('onbsug_1');
    expect(mockCreatePending).toHaveBeenCalledWith('ws_123', 'example.com');
    expect(mockBossSend).toHaveBeenCalledTimes(1);
    const [queue, payload] = mockBossSend.mock.calls[0]!;
    expect(queue).toBe('onboarding-suggest');
    expect(payload).toMatchObject({
      suggestionId: 'onbsug_1',
      workspaceId: 'ws_123',
      domain: 'example.com',
      baseUrl: 'https://example.com',
      roleHint: 'seo',
    });
  });

  describe('regenerate flag', () => {
    it('skips the cache lookup when regenerate=true and enqueues a fresh job', async () => {
      mockFindCached.mockResolvedValueOnce({ ...baseRow, status: 'done' });
      mockFindInFlight.mockResolvedValueOnce(null);
      mockCreatePending.mockResolvedValueOnce(baseRow);
      const { POST } = await import('./route');
      const res = await POST(authedPost({ domain: 'example.com', regenerate: true }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.cached).toBe(false);
      // findRecentCachedSuggestion is not consulted on the regenerate path.
      expect(mockFindCached).not.toHaveBeenCalled();
      expect(mockCreatePending).toHaveBeenCalledWith('ws_123', 'example.com');
      expect(mockBossSend).toHaveBeenCalledTimes(1);
    });

    it('still respects an in-flight job on the regenerate path', async () => {
      mockFindInFlight.mockResolvedValueOnce({ ...baseRow, status: 'fetching' });
      const { POST } = await import('./route');
      const res = await POST(authedPost({ domain: 'example.com', regenerate: true }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.inFlight).toBe(true);
      expect(mockCreatePending).not.toHaveBeenCalled();
      expect(mockBossSend).not.toHaveBeenCalled();
    });

    it('returns 429 when the daily regen limiter rejects', async () => {
      const { RateLimiterRes } = await import('rate-limiter-flexible');
      let consumeCalls = 0;
      consumeOverride = async () => {
        consumeCalls += 1;
        // First call is the burst limiter (passes); second is the daily regen limiter (rejects).
        if (consumeCalls === 1) return { remainingPoints: 99, msBeforeNext: 60000 };
        const err = new RateLimiterRes() as { msBeforeNext: number };
        err.msBeforeNext = 3600_000;
        throw err;
      };
      const { POST } = await import('./route');
      const res = await POST(authedPost({ domain: 'example.com', regenerate: true }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(429);
      expect(mockCreatePending).not.toHaveBeenCalled();
      expect(mockBossSend).not.toHaveBeenCalled();
    });
  });
});

describe('GET /api/v1/onboarding/suggest/[jobId]', () => {
  function authedGet(jobId: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/v1/onboarding/suggest/${jobId}`, {
      method: 'GET',
      headers: { authorization: 'Bearer qk_test_key_12345678901234567890' },
    });
  }

  it('returns the row when scoped to workspace', async () => {
    mockGetById.mockResolvedValueOnce({ ...baseRow, status: 'done' });
    const { GET } = await import('./[jobId]/route');
    const res = await GET(authedGet('onbsug_1'), {
      params: Promise.resolve({ jobId: 'onbsug_1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('done');
  });

  it('returns 404 for an id not in the workspace', async () => {
    mockGetById.mockResolvedValueOnce(null);
    const { GET } = await import('./[jobId]/route');
    const res = await GET(authedGet('onbsug_other'), {
      params: Promise.resolve({ jobId: 'onbsug_other' }),
    });
    expect(res.status).toBe(404);
  });
});
