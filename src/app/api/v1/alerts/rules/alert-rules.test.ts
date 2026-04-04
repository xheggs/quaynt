// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockCreateAlertRule = vi.fn();
const mockListAlertRules = vi.fn();
const mockGetAlertRule = vi.fn();
const mockUpdateAlertRule = vi.fn();
const mockDeleteAlertRule = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/alerts/alert.service', () => ({
  createAlertRule: (...args: unknown[]) => mockCreateAlertRule(...args),
  listAlertRules: (...args: unknown[]) => mockListAlertRules(...args),
  getAlertRule: (...args: unknown[]) => mockGetAlertRule(...args),
  updateAlertRule: (...args: unknown[]) => mockUpdateAlertRule(...args),
  deleteAlertRule: (...args: unknown[]) => mockDeleteAlertRule(...args),
  ALERT_RULE_ALLOWED_SORTS: [
    'name',
    'metric',
    'severity',
    'enabled',
    'createdAt',
    'lastTriggeredAt',
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
    ALERT_MAX_RULES_PER_WORKSPACE: 25,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  },
  setRequestLogger: vi.fn(),
  getRequestLogger: vi.fn().mockReturnValue({ warn: vi.fn() }),
}));

const sampleRule = {
  id: 'alert_test123',
  workspaceId: 'ws_123',
  name: 'Test alert',
  description: null,
  metric: 'recommendation_share',
  promptSetId: 'ps_test',
  scope: { brandId: 'brand_test' },
  condition: 'drops_below',
  threshold: '20.0000',
  direction: 'any',
  cooldownMinutes: 60,
  severity: 'warning',
  enabled: true,
  lastEvaluatedAt: null,
  lastTriggeredAt: null,
  createdAt: new Date('2026-04-02T12:00:00Z'),
  updatedAt: new Date('2026-04-02T12:00:00Z'),
};

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

describe('Alert Rules API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'admin',
    });
  });

  describe('POST /api/v1/alerts/rules', () => {
    it('creates an alert rule with valid input', async () => {
      mockCreateAlertRule.mockResolvedValueOnce(sampleRule);

      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/alerts/rules', {
        name: 'Test alert',
        metric: 'recommendation_share',
        promptSetId: 'ps_test',
        scope: { brandId: 'brand_test' },
        condition: 'drops_below',
        threshold: 20,
      });
      const res = await POST(req, { params: Promise.resolve({}) });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.data.id).toBe('alert_test123');
      expect(data.data.metric).toBe('recommendation_share');
    });

    it('returns 401 without authentication', async () => {
      mockVerifyApiKey.mockResolvedValue(null);

      const { POST } = await import('./route');
      const req = createUnauthRequest('POST', '/api/v1/alerts/rules');
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(401);
    });

    it('returns 422 for missing required fields', async () => {
      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/alerts/rules', {
        name: 'Test',
        // missing metric, promptSetId, scope, condition, threshold
      });
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(422);
    });

    it('returns 422 for invalid metric value', async () => {
      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/alerts/rules', {
        name: 'Test',
        metric: 'invalid_metric',
        promptSetId: 'ps_test',
        scope: { brandId: 'brand_test' },
        condition: 'drops_below',
        threshold: 20,
      });
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(422);
    });

    it('returns 404 when brand not found', async () => {
      mockCreateAlertRule.mockRejectedValueOnce(new Error('Brand not found in this workspace'));

      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/alerts/rules', {
        name: 'Test',
        metric: 'recommendation_share',
        promptSetId: 'ps_test',
        scope: { brandId: 'brand_missing' },
        condition: 'drops_below',
        threshold: 20,
      });
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(404);
    });

    it('returns 409 when workspace rule limit reached', async () => {
      mockCreateAlertRule.mockRejectedValueOnce(
        new Error('Workspace alert rule limit reached (max 25)')
      );

      const { POST } = await import('./route');
      const req = createAuthedRequest('POST', '/api/v1/alerts/rules', {
        name: 'Test',
        metric: 'recommendation_share',
        promptSetId: 'ps_test',
        scope: { brandId: 'brand_test' },
        condition: 'drops_below',
        threshold: 20,
      });
      const res = await POST(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/alerts/rules', () => {
    it('returns paginated list of rules', async () => {
      mockListAlertRules.mockResolvedValueOnce({
        items: [sampleRule],
        total: 1,
      });

      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/alerts/rules');
      const res = await GET(req, { params: Promise.resolve({}) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.data).toHaveLength(1);
      expect(data.data.meta.total).toBe(1);
    });

    it('returns 401 without authentication', async () => {
      mockVerifyApiKey.mockResolvedValue(null);

      const { GET } = await import('./route');
      const req = createUnauthRequest('GET', '/api/v1/alerts/rules');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/alerts/rules/:ruleId', () => {
    it('returns a single rule', async () => {
      mockGetAlertRule.mockResolvedValueOnce(sampleRule);

      const { GET } = await import('./[ruleId]/route');
      const req = createAuthedRequest('GET', '/api/v1/alerts/rules/alert_test123');
      const res = await GET(req, { params: Promise.resolve({ ruleId: 'alert_test123' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.id).toBe('alert_test123');
    });

    it('returns 404 for non-existent rule', async () => {
      mockGetAlertRule.mockResolvedValueOnce(null);

      const { GET } = await import('./[ruleId]/route');
      const req = createAuthedRequest('GET', '/api/v1/alerts/rules/alert_missing');
      const res = await GET(req, { params: Promise.resolve({ ruleId: 'alert_missing' }) });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/alerts/rules/:ruleId', () => {
    it('updates a rule', async () => {
      const updated = { ...sampleRule, name: 'Updated name' };
      mockUpdateAlertRule.mockResolvedValueOnce(updated);

      const { PATCH } = await import('./[ruleId]/route');
      const req = createAuthedRequest('PATCH', '/api/v1/alerts/rules/alert_test123', {
        name: 'Updated name',
      });
      const res = await PATCH(req, { params: Promise.resolve({ ruleId: 'alert_test123' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.name).toBe('Updated name');
    });

    it('returns 404 for non-existent rule', async () => {
      mockUpdateAlertRule.mockResolvedValueOnce(null);

      const { PATCH } = await import('./[ruleId]/route');
      const req = createAuthedRequest('PATCH', '/api/v1/alerts/rules/alert_missing', {
        name: 'Test',
      });
      const res = await PATCH(req, { params: Promise.resolve({ ruleId: 'alert_missing' }) });

      expect(res.status).toBe(404);
    });

    it('returns 422 when trying to change immutable field', async () => {
      mockUpdateAlertRule.mockRejectedValueOnce(
        new Error('Cannot change metric after rule creation')
      );

      const { PATCH } = await import('./[ruleId]/route');
      const req = createAuthedRequest('PATCH', '/api/v1/alerts/rules/alert_test123', {
        name: 'Updated',
      });
      const res = await PATCH(req, { params: Promise.resolve({ ruleId: 'alert_test123' }) });

      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/v1/alerts/rules/:ruleId', () => {
    it('deletes a rule and returns 204', async () => {
      mockDeleteAlertRule.mockResolvedValueOnce(true);

      const { DELETE } = await import('./[ruleId]/route');
      const req = createAuthedRequest('DELETE', '/api/v1/alerts/rules/alert_test123');
      const res = await DELETE(req, { params: Promise.resolve({ ruleId: 'alert_test123' }) });

      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent rule', async () => {
      mockDeleteAlertRule.mockResolvedValueOnce(false);

      const { DELETE } = await import('./[ruleId]/route');
      const req = createAuthedRequest('DELETE', '/api/v1/alerts/rules/alert_missing');
      const res = await DELETE(req, { params: Promise.resolve({ ruleId: 'alert_missing' }) });

      expect(res.status).toBe(404);
    });

    it('returns 403 with read-only scope', async () => {
      mockVerifyApiKey.mockResolvedValue({
        id: 'key_auth',
        workspaceId: 'ws_123',
        scopes: 'read',
      });

      const { DELETE } = await import('./[ruleId]/route');
      const req = createAuthedRequest('DELETE', '/api/v1/alerts/rules/alert_test123');
      const res = await DELETE(req, { params: Promise.resolve({ ruleId: 'alert_test123' }) });

      expect(res.status).toBe(403);
    });
  });
});
