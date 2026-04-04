// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withRequestId, getRequestId } from './request-id';

const handler = async () => NextResponse.json({ data: 'ok' });

describe('withRequestId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a UUID when no X-Request-Id header present', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/test');
    const wrapped = withRequestId(handler);
    const response = await wrapped(req, { params: Promise.resolve({}) });

    const requestId = response.headers.get('X-Request-Id');
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('passes through existing X-Request-Id header', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { 'x-request-id': 'custom-id-123' },
    });
    const wrapped = withRequestId(handler);
    const response = await wrapped(req, { params: Promise.resolve({}) });

    expect(response.headers.get('X-Request-Id')).toBe('custom-id-123');
  });

  it('stores request ID in WeakMap accessible via getRequestId', async () => {
    let capturedId: string | undefined;
    const capturingHandler = async (req: NextRequest) => {
      capturedId = getRequestId(req);
      return NextResponse.json({ data: 'ok' });
    };

    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { 'x-request-id': 'stored-id' },
    });
    const wrapped = withRequestId(capturingHandler);
    await wrapped(req, { params: Promise.resolve({}) });

    expect(capturedId).toBe('stored-id');
  });

  it('returns undefined from getRequestId for unwrapped requests', () => {
    const req = new Request('http://localhost:3000/api/v1/test');
    expect(getRequestId(req)).toBeUndefined();
  });
});
