// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const handler = async () => NextResponse.json({ data: 'ok' });

describe('withCors (specific origins)', () => {
  // Use a fresh module import for each test to avoid state from other suites
  async function importCors(origins: string) {
    vi.resetModules();
    vi.doMock('@/lib/config/env', () => ({
      env: { CORS_ALLOWED_ORIGINS: origins },
    }));
    return import('./cors');
  }

  it('returns 204 for OPTIONS preflight request', async () => {
    const { withCors } = await importCors('http://localhost:3000,https://app.quaynt.com');
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    const wrapped = withCors(handler);
    const response = await wrapped(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('reflects matching origin in Access-Control-Allow-Origin', async () => {
    const { withCors } = await importCors('http://localhost:3000,https://app.quaynt.com');
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { origin: 'https://app.quaynt.com' },
    });
    const wrapped = withCors(handler);
    const response = await wrapped(req, { params: Promise.resolve({}) });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.quaynt.com');
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('does not set Access-Control-Allow-Origin for non-matching origin', async () => {
    const { withCors } = await importCors('http://localhost:3000,https://app.quaynt.com');
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { origin: 'https://evil.com' },
    });
    const wrapped = withCors(handler);
    const response = await wrapped(req, { params: Promise.resolve({}) });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('appends CORS headers to regular requests', async () => {
    const { withCors } = await importCors('http://localhost:3000,https://app.quaynt.com');
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { origin: 'http://localhost:3000' },
    });
    const wrapped = withCors(handler);
    const response = await wrapped(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('sets Access-Control-Allow-Origin to * in wildcard mode', async () => {
    const { withCors } = await importCors('*');
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { origin: 'https://anything.com' },
    });
    const wrapped = withCors(handler);
    const response = await wrapped(req, { params: Promise.resolve({}) });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
