// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();

vi.mock('@/lib/logger', () => {
  const child = vi.fn().mockReturnValue({
    info: (...args: unknown[]) => mockInfo(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: (...args: unknown[]) => mockError(...args),
  });
  return {
    logger: { child },
    setRequestLogger: vi.fn(),
  };
});

vi.mock('./request-id', () => ({
  getRequestId: () => 'req_test_123',
}));

import { withRequestLog } from './request-log';

describe('withRequestLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs request received on start', async () => {
    const handler = async () => NextResponse.json({ data: 'ok' });
    const wrapped = withRequestLog(handler);

    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { 'user-agent': 'test-agent' },
    });
    await wrapped(req, { params: Promise.resolve({}) });

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({ userAgent: 'test-agent' }),
      'request received'
    );
  });

  it('logs completion with status and duration for 2xx', async () => {
    const handler = async () => NextResponse.json({ data: 'ok' });
    const wrapped = withRequestLog(handler);

    const req = new NextRequest('http://localhost:3000/api/v1/test');
    await wrapped(req, { params: Promise.resolve({}) });

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        durationMs: expect.any(Number),
      }),
      'request completed'
    );
  });

  it('logs at warn level for 4xx responses', async () => {
    const handler = async () => NextResponse.json({ error: 'bad' }, { status: 400 });
    const wrapped = withRequestLog(handler);

    const req = new NextRequest('http://localhost:3000/api/v1/test');
    await wrapped(req, { params: Promise.resolve({}) });

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
      'request completed'
    );
  });

  it('logs at error level for 5xx responses', async () => {
    const handler = async () => NextResponse.json({ error: 'internal' }, { status: 500 });
    const wrapped = withRequestLog(handler);

    const req = new NextRequest('http://localhost:3000/api/v1/test');
    await wrapped(req, { params: Promise.resolve({}) });

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500 }),
      'request completed'
    );
  });

  it('catches unhandled errors and returns 500', async () => {
    const handler = async () => {
      throw new Error('kaboom');
    };
    const wrapped = withRequestLog(handler);

    const req = new NextRequest('http://localhost:3000/api/v1/test');
    const response = await wrapped(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'unhandled error in request handler'
    );
  });

  it('does not log sensitive data', async () => {
    const handler = async () => NextResponse.json({ data: 'ok' });
    const wrapped = withRequestLog(handler);

    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: {
        authorization: 'Bearer qk_secret_key',
        cookie: 'session=abc123',
      },
    });
    await wrapped(req, { params: Promise.resolve({}) });

    for (const call of [...mockInfo.mock.calls, ...mockWarn.mock.calls, ...mockError.mock.calls]) {
      const logData = JSON.stringify(call);
      expect(logData).not.toContain('qk_secret_key');
      expect(logData).not.toContain('session=abc123');
    }
  });
});
