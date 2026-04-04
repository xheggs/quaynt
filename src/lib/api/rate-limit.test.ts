// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockConsume = vi.fn();

vi.mock('rate-limiter-flexible', () => {
  class RateLimiterPostgres {
    consume = mockConsume;
  }
  class RateLimiterRes {
    remainingPoints: number;
    msBeforeNext: number;
    constructor(remainingPoints: number, msBeforeNext: number) {
      this.remainingPoints = remainingPoints;
      this.msBeforeNext = msBeforeNext;
    }
  }
  return { RateLimiterPostgres, RateLimiterRes };
});

vi.mock('@/lib/db/pool', () => ({
  pool: {},
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    RATE_LIMIT_POINTS: 100,
    RATE_LIMIT_DURATION: 60,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
  getRequestLogger: vi.fn().mockReturnValue({ warn: vi.fn() }),
}));

const mockAuthContext = {
  method: 'api-key' as const,
  userId: null,
  apiKeyId: 'key_test',
  workspaceId: 'ws_123',
  scopes: ['admin' as const],
};

vi.mock('./middleware', () => ({
  getAuthContext: () => mockAuthContext,
}));

import { withRateLimit } from './rate-limit';

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/test', {
    headers: { authorization: 'Bearer qk_test_key' },
  });
}

const successHandler = async () => NextResponse.json({ data: 'ok' });

describe('withRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets X-RateLimit headers on success', async () => {
    mockConsume.mockResolvedValueOnce({
      remainingPoints: 99,
      msBeforeNext: 60000,
    });

    const handler = withRateLimit(successHandler);
    const response = await handler(createRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  it('returns 429 when rate limit exhausted', async () => {
    const { RateLimiterRes } = await import('rate-limiter-flexible');
    mockConsume.mockRejectedValueOnce(new RateLimiterRes(0, 30000));

    const handler = withRateLimit(successHandler);
    const response = await handler(createRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('fails open on database error', async () => {
    mockConsume.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const handler = withRateLimit(successHandler);
    const response = await handler(createRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBe('ok');
  });

  it('uses apiKeyId as rate limit key for API key auth', async () => {
    mockConsume.mockResolvedValueOnce({
      remainingPoints: 99,
      msBeforeNext: 60000,
    });

    const handler = withRateLimit(successHandler);
    await handler(createRequest(), { params: Promise.resolve({}) });

    expect(mockConsume).toHaveBeenCalledWith('key_test', 1);
  });
});
