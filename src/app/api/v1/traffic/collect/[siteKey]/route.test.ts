// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockCollectVisit = vi.fn();

vi.mock('@/modules/traffic/traffic-collector.service', () => ({
  collectVisit: (...args: unknown[]) => mockCollectVisit(...args),
}));

vi.mock('rate-limiter-flexible', () => {
  class RateLimiterPostgres {
    consume = vi.fn().mockResolvedValue({ remainingPoints: 99, msBeforeNext: 60000 });
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

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi
      .fn()
      .mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  },
  setRequestLogger: vi.fn(),
  getRequestLogger: vi.fn().mockReturnValue({ debug: vi.fn(), warn: vi.fn() }),
}));

function buildRequest(
  siteKey: string,
  opts: {
    body?: object;
    contentType?: string;
    headers?: Record<string, string>;
  } = {}
): { req: NextRequest; params: Promise<{ siteKey: string }> } {
  const headers = new Headers({ ...opts.headers });
  if (opts.body !== undefined) {
    headers.set('content-type', opts.contentType ?? 'application/json');
  }
  const req = new NextRequest(`http://localhost:3000/api/v1/traffic/collect/${siteKey}`, {
    method: 'POST',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { req, params: Promise.resolve({ siteKey }) };
}

describe('POST /api/v1/traffic/collect/:siteKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectVisit.mockResolvedValue({ accepted: true, platform: 'chatgpt' });
  });

  it('returns 204 on a valid snippet POST (application/json)', async () => {
    const { POST } = await import('./route');
    const validSiteKey = 'tsk_' + 'a'.repeat(32);
    const { req, params } = buildRequest(validSiteKey, {
      body: { referrer: 'https://chatgpt.com', landingPath: '/blog' },
    });
    const response = await POST(req, { params });
    expect(response.status).toBe(204);
    expect(mockCollectVisit).toHaveBeenCalledOnce();
  });

  it('returns 204 on a text/plain body (sendBeacon default)', async () => {
    const { POST } = await import('./route');
    const validSiteKey = 'tsk_' + 'a'.repeat(32);
    const { req, params } = buildRequest(validSiteKey, {
      body: { referrer: 'https://chatgpt.com', landingPath: '/blog' },
      contentType: 'text/plain;charset=UTF-8',
    });
    const response = await POST(req, { params });
    expect(response.status).toBe(204);
    expect(mockCollectVisit).toHaveBeenCalledOnce();
  });

  it('returns 204 and skips DB for malformed siteKey path', async () => {
    const { POST } = await import('./route');
    const { req, params } = buildRequest('malformed_key', {
      body: { referrer: 'https://chatgpt.com', landingPath: '/' },
    });
    const response = await POST(req, { params });
    expect(response.status).toBe(204);
    expect(mockCollectVisit).not.toHaveBeenCalled();
  });

  it('returns 204 for DNT: 1', async () => {
    const { POST } = await import('./route');
    const validSiteKey = 'tsk_' + 'a'.repeat(32);
    const { req, params } = buildRequest(validSiteKey, {
      body: { referrer: 'https://chatgpt.com', landingPath: '/' },
      headers: { dnt: '1' },
    });
    const response = await POST(req, { params });
    expect(response.status).toBe(204);
    expect(mockCollectVisit).not.toHaveBeenCalled();
  });

  it('returns 204 for Sec-GPC: 1', async () => {
    const { POST } = await import('./route');
    const validSiteKey = 'tsk_' + 'a'.repeat(32);
    const { req, params } = buildRequest(validSiteKey, {
      body: { referrer: 'https://chatgpt.com', landingPath: '/' },
      headers: { 'sec-gpc': '1' },
    });
    const response = await POST(req, { params });
    expect(response.status).toBe(204);
    expect(mockCollectVisit).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed body', async () => {
    const { POST } = await import('./route');
    const validSiteKey = 'tsk_' + 'a'.repeat(32);
    const { req, params } = buildRequest(validSiteKey, {
      body: { landingPath: 42 /* invalid type */ } as unknown as object,
    });
    const response = await POST(req, { params });
    expect(response.status).toBe(400);
  });

  it('returns 204 when collector drops the visit (privacy: response code does not leak drop reason)', async () => {
    mockCollectVisit.mockResolvedValueOnce({ accepted: false, reason: 'not_ai_source' });
    const { POST } = await import('./route');
    const validSiteKey = 'tsk_' + 'a'.repeat(32);
    const { req, params } = buildRequest(validSiteKey, {
      body: { referrer: 'https://example.com', landingPath: '/' },
    });
    const response = await POST(req, { params });
    expect(response.status).toBe(204);
  });

  it('does not return the client IP or any sensitive header in the response', async () => {
    const { POST } = await import('./route');
    const validSiteKey = 'tsk_' + 'a'.repeat(32);
    const { req, params } = buildRequest(validSiteKey, {
      body: { referrer: 'https://chatgpt.com', landingPath: '/' },
      headers: { 'x-forwarded-for': '203.0.113.42' },
    });
    const response = await POST(req, { params });
    for (const [, value] of response.headers.entries()) {
      expect(String(value)).not.toContain('203.0.113.42');
    }
  });
});

describe('OPTIONS /api/v1/traffic/collect/:siteKey', () => {
  it('returns 204 with CORS headers', async () => {
    const { OPTIONS } = await import('./route');
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('GET /api/v1/traffic/collect/:siteKey', () => {
  it('returns 405', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(405);
  });
});
