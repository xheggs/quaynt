// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFetchExportData = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/exports/export.fetchers', () => ({
  fetchExportData: (...args: unknown[]) => mockFetchExportData(...args),
}));

vi.mock('@/modules/exports/export.columns', async () => {
  const actual = await vi.importActual('@/modules/exports/export.columns');
  return actual;
});

vi.mock('@/modules/exports/export.types', async () => {
  const actual = await vi.importActual('@/modules/exports/export.types');
  return actual;
});

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
      return Promise.resolve({ remainingPoints: 19, msBeforeNext: 60000 });
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

async function* emptyAsyncIterable(): AsyncGenerator<Record<string, unknown>> {
  // yields nothing
}

async function* sampleRows(): AsyncGenerator<Record<string, unknown>> {
  yield {
    brandName: 'Acme',
    brandId: 'brand_1',
    market: 'Test',
    periodFrom: '2026-03-01',
    periodTo: '2026-03-31',
    platform: '_all',
    locale: '_all',
    metric: 'recommendation_share',
    currentValue: '50.00',
    previousValue: '40.00',
    delta: '10.00',
    changeRate: '25.00',
    direction: 'up',
  };
}

async function responseText(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    chunks.reduce((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array())
  );
}

const basePath = '/api/v1/exports';

describe('GET /api/v1/exports — JSON/JSONL format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchExportData.mockReset();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'read-write',
    });
  });

  it('returns 200 with valid JSON for report export (format=json)', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: sampleRows() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?format=json&type=report&promptSetId=ps_1&brandId=brand_1`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const text = await responseText(res);
    const parsed = JSON.parse(text);
    expect(parsed.meta).toBeDefined();
    expect(parsed.data).toBeDefined();
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].brandName).toBe('Acme');
  });

  it('returns correct Content-Type for JSON format', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=json&type=report&promptSetId=ps_1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  });

  it('returns correct Content-Disposition for JSON format', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?format=json&type=citations&from=2026-03-01&to=2026-03-31`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="citations_2026-03-01_2026-03-31.json"'
    );
  });

  it('JSON meta.columns includes translated labels', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=json&type=citations`);
    const res = await GET(req, { params: Promise.resolve({}) });

    const text = await responseText(res);
    const parsed = JSON.parse(text);
    expect(parsed.meta.columns).toBeDefined();
    expect(parsed.meta.columns.length).toBeGreaterThan(0);
    const brandCol = parsed.meta.columns.find((c: { key: string }) => c.key === 'brandId');
    expect(brandCol).toBeDefined();
    expect(brandCol.label).toBe('Brand ID');
  });

  it('JSON empty result returns valid JSON with empty data array', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=json&type=citations`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const text = await responseText(res);
    const parsed = JSON.parse(text);
    expect(parsed.data).toEqual([]);
  });

  it('JSON includes X-Export-Truncated header when row limit reached', async () => {
    mockFetchExportData.mockResolvedValueOnce({
      rows: emptyAsyncIterable(),
      truncated: true,
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=json&type=citations`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('X-Export-Truncated')).toBe('true');
    expect(res.headers.get('X-Export-Row-Limit')).toBe('100000');
  });

  it('returns 200 with valid JSONL for report export (format=jsonl)', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: sampleRows() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?format=jsonl&type=report&promptSetId=ps_1&brandId=brand_1`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const text = await responseText(res);
    const lines = text.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.brandName).toBe('Acme');
  });

  it('returns correct Content-Type for JSONL format', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=jsonl&type=citations`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8');
  });

  it('returns correct Content-Disposition for JSONL format', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?format=jsonl&type=citations&from=2026-03-01&to=2026-03-31`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="citations_2026-03-01_2026-03-31.jsonl"'
    );
  });

  it('JSONL has no meta envelope', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: sampleRows() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?format=jsonl&type=report&promptSetId=ps_1&brandId=brand_1`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    const text = await responseText(res);
    expect(text).not.toContain('"meta"');
  });

  it('JSONL empty result returns 200 with empty body', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=jsonl&type=citations`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    const text = await responseText(res);
    expect(text).toBe('');
  });

  it('returns 400 for format=xml listing csv, json, jsonl', async () => {
    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=xml&type=citations`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain('csv');
    expect(body.error.message).toContain('json');
    expect(body.error.message).toContain('jsonl');
  });

  it('returns 401 for JSON format without authentication', async () => {
    const { GET } = await import('./route');
    const req = createUnauthenticatedRequest(`${basePath}?format=json&type=citations`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
  });

  it('returns 403 for JSON format without read scope', async () => {
    mockVerifyApiKey.mockResolvedValueOnce({
      id: 'key_no_scope',
      workspaceId: 'ws_123',
      scopes: '',
    });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=json&type=citations`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(403);
  });

  it('JSON format works for opportunities export type', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(
      `${basePath}?format=json&type=opportunities&promptSetId=ps_1&brandId=brand_1`
    );
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    const text = await responseText(res);
    const parsed = JSON.parse(text);
    expect(parsed.meta.exportType).toBe('opportunities');
  });

  it('JSONL format works for sentiment export type', async () => {
    mockFetchExportData.mockResolvedValueOnce({ rows: emptyAsyncIterable() });

    const { GET } = await import('./route');
    const req = createAuthedRequest(`${basePath}?format=jsonl&type=sentiment&promptSetId=ps_1`);
    const res = await GET(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8');
  });
});
