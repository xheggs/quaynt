// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGenerateApiKey = vi.fn();
const mockListApiKeys = vi.fn();
const mockGetApiKey = vi.fn();
const mockRevokeApiKey = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/workspace/api-key.service', () => ({
  generateApiKey: (...args: unknown[]) => mockGenerateApiKey(...args),
  listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  getApiKey: (...args: unknown[]) => mockGetApiKey(...args),
  revokeApiKey: (...args: unknown[]) => mockRevokeApiKey(...args),
  verifyApiKey: (...args: unknown[]) => mockVerifyApiKey(...args),
  API_KEY_ALLOWED_SORTS: ['createdAt', 'name'],
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
  logger: { child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
  setRequestLogger: vi.fn(),
  getRequestLogger: vi.fn().mockReturnValue({ warn: vi.fn() }),
}));

function createAuthedRequest(method: string, path: string, body?: object): NextRequest {
  const headers = new Headers({
    authorization: 'Bearer qk_test_key_12345678901234567890',
  });
  if (body) {
    headers.set('content-type', 'application/json');
  }
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('API key endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'admin',
    });
  });

  describe('POST /api/v1/api-keys', () => {
    it('creates an API key with valid input', async () => {
      mockGenerateApiKey.mockResolvedValueOnce({
        id: 'key_new',
        name: 'My Key',
        keyPrefix: 'qk_abc1234',
        key: 'qk_full_plaintext_key_here',
        scopes: 'read',
        expiresAt: null,
        createdAt: new Date().toISOString(),
      });

      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/api-keys', {
        name: 'My Key',
        scope: 'read',
      });

      const response = await POST(req, { params: Promise.resolve({}) });
      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.data.key).toBeDefined();
    });

    it('rejects invalid body with 422', async () => {
      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/api-keys', {
        name: '',
        scope: 'invalid',
      });

      const response = await POST(req, { params: Promise.resolve({}) });
      expect(response.status).toBe(422);
    });

    it('rejects missing body with 400', async () => {
      const { POST } = await import('./route');
      const req = new NextRequest('http://localhost:3000/api/v1/api-keys', {
        method: 'POST',
        headers: {
          authorization: 'Bearer qk_test_key_12345678901234567890',
        },
      });

      const response = await POST(req, { params: Promise.resolve({}) });
      expect(response.status).toBe(400);
    });

    it('returns 403 with read-only API key', async () => {
      mockVerifyApiKey.mockResolvedValueOnce({
        id: 'key_auth',
        workspaceId: 'ws_123',
        scopes: 'read',
      });

      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/api-keys', {
        name: 'Test',
        scope: 'read',
      });

      const response = await POST(req, { params: Promise.resolve({}) });
      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/api-keys', () => {
    it('lists API keys with pagination', async () => {
      mockListApiKeys.mockResolvedValueOnce({
        items: [
          {
            id: 'key_1',
            name: 'Key 1',
            keyPrefix: 'qk_abc1234',
            scopes: 'admin',
            lastUsedAt: null,
            expiresAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
      });

      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/api-keys?page=1&limit=10');

      const response = await GET(req, { params: Promise.resolve({}) });
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.data.data).toHaveLength(1);
      expect(body.data.meta).toEqual({ page: 1, limit: 10, total: 1 });
    });

    it('returns 401 without auth', async () => {
      mockVerifyApiKey.mockResolvedValueOnce(null);

      const { GET } = await import('./route');
      const req = new NextRequest('http://localhost:3000/api/v1/api-keys', {
        headers: { authorization: 'Bearer qk_invalid' },
      });

      const response = await GET(req, { params: Promise.resolve({}) });
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid sort field', async () => {
      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/api-keys?sort=invalid');

      const response = await GET(req, { params: Promise.resolve({}) });
      expect(response.status).toBe(400);
    });

    it('includes rate limit headers', async () => {
      mockListApiKeys.mockResolvedValueOnce({ items: [], total: 0 });

      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/api-keys');

      const response = await GET(req, { params: Promise.resolve({}) });
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    });

    it('includes X-Request-Id header', async () => {
      mockListApiKeys.mockResolvedValueOnce({ items: [], total: 0 });

      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/api-keys');

      const response = await GET(req, { params: Promise.resolve({}) });
      expect(response.headers.get('X-Request-Id')).toBeDefined();
    });
  });

  describe('GET /api/v1/api-keys/:keyId', () => {
    it('returns a single API key', async () => {
      mockGetApiKey.mockResolvedValueOnce({
        id: 'key_1',
        name: 'Key 1',
        keyPrefix: 'qk_abc1234',
        scopes: 'admin',
      });

      const { GET } = await import('./[keyId]/route');
      const req = createAuthedRequest('GET', '/api/v1/api-keys/key_1');

      const response = await GET(req, {
        params: Promise.resolve({ keyId: 'key_1' }),
      });
      expect(response.status).toBe(200);
    });

    it('returns 404 for non-existent key', async () => {
      mockGetApiKey.mockResolvedValueOnce(null);

      const { GET } = await import('./[keyId]/route');
      const req = createAuthedRequest('GET', '/api/v1/api-keys/key_none');

      const response = await GET(req, {
        params: Promise.resolve({ keyId: 'key_none' }),
      });
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/api-keys/:keyId', () => {
    it('revokes an API key and returns 204', async () => {
      mockRevokeApiKey.mockResolvedValueOnce(true);

      const { DELETE } = await import('./[keyId]/route');
      const req = createAuthedRequest('DELETE', '/api/v1/api-keys/key_1');

      const response = await DELETE(req, {
        params: Promise.resolve({ keyId: 'key_1' }),
      });
      expect(response.status).toBe(204);
    });

    it('returns 404 when key not found', async () => {
      mockRevokeApiKey.mockResolvedValueOnce(false);

      const { DELETE } = await import('./[keyId]/route');
      const req = createAuthedRequest('DELETE', '/api/v1/api-keys/key_none');

      const response = await DELETE(req, {
        params: Promise.resolve({ keyId: 'key_none' }),
      });
      expect(response.status).toBe(404);
    });

    it('returns 403 with read-only API key', async () => {
      mockVerifyApiKey.mockResolvedValueOnce({
        id: 'key_auth',
        workspaceId: 'ws_123',
        scopes: 'read',
      });

      const { DELETE } = await import('./[keyId]/route');
      const req = createAuthedRequest('DELETE', '/api/v1/api-keys/key_1');

      const response = await DELETE(req, {
        params: Promise.resolve({ keyId: 'key_1' }),
      });
      expect(response.status).toBe(403);
    });
  });
});
