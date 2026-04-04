// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockCreateWebhookEndpoint = vi.fn();
const mockListWebhookEndpoints = vi.fn();
const mockGetWebhookEndpoint = vi.fn();
const mockUpdateWebhookEndpoint = vi.fn();
const mockDeleteWebhookEndpoint = vi.fn();
const mockRotateWebhookEndpointSecret = vi.fn();
const mockSendTestEvent = vi.fn();
const mockListDeliveries = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/webhooks/webhook.service', () => ({
  createWebhookEndpoint: (...args: unknown[]) => mockCreateWebhookEndpoint(...args),
  listWebhookEndpoints: (...args: unknown[]) => mockListWebhookEndpoints(...args),
  getWebhookEndpoint: (...args: unknown[]) => mockGetWebhookEndpoint(...args),
  updateWebhookEndpoint: (...args: unknown[]) => mockUpdateWebhookEndpoint(...args),
  deleteWebhookEndpoint: (...args: unknown[]) => mockDeleteWebhookEndpoint(...args),
  rotateWebhookEndpointSecret: (...args: unknown[]) => mockRotateWebhookEndpointSecret(...args),
  sendTestEvent: (...args: unknown[]) => mockSendTestEvent(...args),
  listDeliveries: (...args: unknown[]) => mockListDeliveries(...args),
  WEBHOOK_ENDPOINT_ALLOWED_SORTS: ['createdAt', 'url'],
  WEBHOOK_DELIVERY_ALLOWED_SORTS: ['createdAt', 'status'],
}));

vi.mock('@/modules/webhooks/webhook.events', () => ({
  WEBHOOK_EVENT_TYPES: [
    'citation.new',
    'citation.updated',
    'alert.triggered',
    'report.generated',
    'model_run.completed',
    'webhook.test',
  ],
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
    child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  },
  setRequestLogger: vi.fn(),
  getRequestLogger: vi.fn().mockReturnValue({ warn: vi.fn() }),
}));

vi.mock('@/lib/jobs/boss', () => ({
  createBoss: vi.fn().mockReturnValue({
    send: vi.fn().mockResolvedValue('job_123'),
  }),
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

function createUnauthRequest(method: string, path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { method });
}

describe('Webhook API endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'admin',
    });
  });

  describe('POST /api/v1/webhooks', () => {
    it('creates a webhook endpoint with valid input', async () => {
      mockCreateWebhookEndpoint.mockResolvedValueOnce({
        id: 'wh_new',
        url: 'https://example.com/webhook',
        events: ['citation.new'],
        description: null,
        secret: 'a'.repeat(64),
        enabled: true,
        createdAt: new Date().toISOString(),
      });

      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/webhooks', {
        url: 'https://example.com/webhook',
        events: ['citation.new'],
      });
      const res = await POST(req, { params: Promise.resolve({}) });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.data.id).toBe('wh_new');
      expect(data.data.secret).toBeDefined();
    });

    it('returns 401 without authentication', async () => {
      mockVerifyApiKey.mockResolvedValue(null);

      const { POST } = await import('./route');
      const req = createUnauthRequest('POST', '/api/v1/webhooks');
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(401);
    });

    it('returns 422 for invalid event types', async () => {
      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/webhooks', {
        url: 'https://example.com/webhook',
        events: ['invalid.event'],
      });
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(422);
    });

    it('returns 422 for invalid URL', async () => {
      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/webhooks', {
        url: 'not-a-url',
        events: ['citation.new'],
      });
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(422);
    });

    it('returns 422 for empty events', async () => {
      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/webhooks', {
        url: 'https://example.com/webhook',
        events: [],
      });
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/v1/webhooks', () => {
    it('returns paginated list of endpoints', async () => {
      mockListWebhookEndpoints.mockResolvedValueOnce({
        items: [
          {
            id: 'wh_1',
            url: 'https://example.com/webhook',
            events: ['citation.new'],
            enabled: true,
          },
        ],
        total: 1,
      });

      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/webhooks');
      const res = await GET(req, { params: Promise.resolve({}) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.data).toHaveLength(1);
      expect(data.data.meta).toBeDefined();
      expect(data.data.meta.total).toBe(1);
    });

    it('allows read scope', async () => {
      mockVerifyApiKey.mockResolvedValue({
        id: 'key_auth',
        workspaceId: 'ws_123',
        scopes: 'read',
      });
      mockListWebhookEndpoints.mockResolvedValueOnce({
        items: [],
        total: 0,
      });

      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/webhooks');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/webhooks/:webhookId', () => {
    it('returns endpoint details', async () => {
      mockGetWebhookEndpoint.mockResolvedValueOnce({
        id: 'wh_1',
        url: 'https://example.com/webhook',
        events: ['citation.new'],
        enabled: true,
      });

      const { GET } = await import('./[webhookId]/route');
      const req = createAuthedRequest('GET', '/api/v1/webhooks/wh_1');
      const res = await GET(req, {
        params: Promise.resolve({ webhookId: 'wh_1' }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.id).toBe('wh_1');
    });

    it('returns 404 for missing endpoint', async () => {
      mockGetWebhookEndpoint.mockResolvedValueOnce(null);

      const { GET } = await import('./[webhookId]/route');
      const req = createAuthedRequest('GET', '/api/v1/webhooks/wh_missing');
      const res = await GET(req, {
        params: Promise.resolve({ webhookId: 'wh_missing' }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/webhooks/:webhookId', () => {
    it('returns 204 on successful delete', async () => {
      mockDeleteWebhookEndpoint.mockResolvedValueOnce(true);

      const { DELETE } = await import('./[webhookId]/route');
      const req = createAuthedRequest('DELETE', '/api/v1/webhooks/wh_1');
      const res = await DELETE(req, {
        params: Promise.resolve({ webhookId: 'wh_1' }),
      });

      expect(res.status).toBe(204);
    });

    it('returns 403 with read scope', async () => {
      mockVerifyApiKey.mockResolvedValue({
        id: 'key_auth',
        workspaceId: 'ws_123',
        scopes: 'read',
      });

      const { DELETE } = await import('./[webhookId]/route');
      const req = createAuthedRequest('DELETE', '/api/v1/webhooks/wh_1');
      const res = await DELETE(req, {
        params: Promise.resolve({ webhookId: 'wh_1' }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/webhooks/:webhookId/test', () => {
    it('sends a test event', async () => {
      mockSendTestEvent.mockResolvedValueOnce({
        eventId: 'evt_test',
        deliveryIds: ['whd_test'],
      });

      const { POST } = await import('./[webhookId]/test/route');
      const req = createAuthedRequest('POST', '/api/v1/webhooks/wh_1/test');
      const res = await POST(req, {
        params: Promise.resolve({ webhookId: 'wh_1' }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.eventId).toBe('evt_test');
      expect(data.data.deliveryId).toBe('whd_test');
    });
  });

  describe('POST /api/v1/webhooks/:webhookId/secret/rotate', () => {
    it('returns new secret', async () => {
      mockRotateWebhookEndpointSecret.mockResolvedValueOnce({
        secret: 'b'.repeat(64),
      });

      const { POST } = await import('./[webhookId]/secret/rotate/route');
      const req = createAuthedRequest('POST', '/api/v1/webhooks/wh_1/secret/rotate');
      const res = await POST(req, {
        params: Promise.resolve({ webhookId: 'wh_1' }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.secret).toHaveLength(64);
    });
  });

  describe('GET /api/v1/webhooks/:webhookId/deliveries', () => {
    it('returns paginated delivery list', async () => {
      mockListDeliveries.mockResolvedValueOnce({
        items: [
          {
            id: 'whd_1',
            eventType: 'citation.new',
            status: 'success',
            httpStatus: 200,
          },
        ],
        total: 1,
      });

      const { GET } = await import('./[webhookId]/deliveries/route');
      const req = createAuthedRequest('GET', '/api/v1/webhooks/wh_1/deliveries');
      const res = await GET(req, {
        params: Promise.resolve({ webhookId: 'wh_1' }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.data).toHaveLength(1);
      expect(data.data.meta.total).toBe(1);
    });
  });
});
