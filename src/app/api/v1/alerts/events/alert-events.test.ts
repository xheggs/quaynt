// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockListAlertEvents = vi.fn();
const mockGetAlertEvent = vi.fn();
const mockAcknowledgeAlertEvent = vi.fn();
const mockSnoozeAlertEvent = vi.fn();
const mockGetAlertSummary = vi.fn();
const mockVerifyApiKey = vi.fn();

vi.mock('@/modules/alerts/alert.service', () => ({
  listAlertEvents: (...args: unknown[]) => mockListAlertEvents(...args),
  getAlertEvent: (...args: unknown[]) => mockGetAlertEvent(...args),
  acknowledgeAlertEvent: (...args: unknown[]) => mockAcknowledgeAlertEvent(...args),
  snoozeAlertEvent: (...args: unknown[]) => mockSnoozeAlertEvent(...args),
  getAlertSummary: (...args: unknown[]) => mockGetAlertSummary(...args),
  ALERT_EVENT_ALLOWED_SORTS: ['severity', 'triggeredAt', 'acknowledgedAt', 'snoozedUntil'],
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

vi.mock('@/lib/jobs/boss', () => ({
  createBoss: vi.fn().mockReturnValue({}),
}));

const sampleEvent = {
  id: 'alertevt_test123',
  alertRuleId: 'alertRule_test456',
  ruleName: 'Test rule',
  workspaceId: 'ws_123',
  severity: 'warning',
  status: 'active',
  metricValue: '15.0000',
  previousValue: '22.0000',
  threshold: '20.0000',
  condition: 'drops_below',
  scopeSnapshot: { brandId: 'brand_test' },
  triggeredAt: new Date('2026-04-02T10:00:00Z'),
  acknowledgedAt: null,
  snoozedUntil: null,
  createdAt: new Date('2026-04-02T10:00:00Z'),
  updatedAt: new Date('2026-04-02T10:00:00Z'),
};

const sampleSummary = {
  total: 10,
  active: 5,
  acknowledged: 3,
  snoozed: 2,
  bySeverity: { info: 2, warning: 5, critical: 3 },
  topRules: [{ ruleId: 'alertRule_1', ruleName: 'Rule 1', count: 5 }],
  period: { from: '2026-03-05T00:00:00.000Z', to: '2026-04-04T00:00:00.000Z' },
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

describe('Alert Events API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyApiKey.mockResolvedValue({
      id: 'key_auth',
      workspaceId: 'ws_123',
      scopes: 'admin',
    });
  });

  describe('GET /api/v1/alerts/events', () => {
    it('returns paginated events', async () => {
      mockListAlertEvents.mockResolvedValueOnce({
        items: [sampleEvent],
        total: 1,
      });

      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/alerts/events');
      const res = await GET(req, { params: Promise.resolve({}) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.data).toHaveLength(1);
      expect(data.data.meta.total).toBe(1);
    });

    it('returns 401 without authentication', async () => {
      mockVerifyApiKey.mockResolvedValue(null);

      const { GET } = await import('./route');
      const req = createUnauthRequest('GET', '/api/v1/alerts/events');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid severity filter', async () => {
      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/alerts/events?severity=invalid');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid status filter', async () => {
      const { GET } = await import('./route');
      const req = createAuthedRequest('GET', '/api/v1/alerts/events?status=invalid');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(400);
    });

    it('passes filters to service', async () => {
      mockListAlertEvents.mockResolvedValueOnce({ items: [], total: 0 });

      const { GET } = await import('./route');
      const req = createAuthedRequest(
        'GET',
        '/api/v1/alerts/events?severity=critical&status=active&alertRuleId=alertRule_test'
      );
      await GET(req, { params: Promise.resolve({}) });

      expect(mockListAlertEvents).toHaveBeenCalledWith(
        'ws_123',
        expect.any(Object),
        expect.objectContaining({
          severity: 'critical',
          status: 'active',
          alertRuleId: 'alertRule_test',
        })
      );
    });
  });

  describe('PATCH /api/v1/alerts/events/:id/acknowledge', () => {
    it('acknowledges an event', async () => {
      const acknowledged = {
        ...sampleEvent,
        acknowledgedAt: new Date(),
        status: 'acknowledged',
      };
      mockAcknowledgeAlertEvent.mockResolvedValueOnce(acknowledged);

      const { PATCH } = await import('./[eventId]/acknowledge/route');
      const req = createAuthedRequest(
        'PATCH',
        '/api/v1/alerts/events/alertevt_test123/acknowledge'
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_test123' }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.status).toBe('acknowledged');
    });

    it('returns 404 for non-existent event', async () => {
      mockAcknowledgeAlertEvent.mockResolvedValueOnce(null);

      const { PATCH } = await import('./[eventId]/acknowledge/route');
      const req = createAuthedRequest(
        'PATCH',
        '/api/v1/alerts/events/alertevt_missing/acknowledge'
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_missing' }),
      });

      expect(res.status).toBe(404);
    });

    it('is idempotent', async () => {
      const acknowledged = {
        ...sampleEvent,
        acknowledgedAt: new Date('2026-04-02T11:00:00Z'),
        status: 'acknowledged',
      };
      mockAcknowledgeAlertEvent.mockResolvedValueOnce(acknowledged);

      const { PATCH } = await import('./[eventId]/acknowledge/route');
      const req = createAuthedRequest(
        'PATCH',
        '/api/v1/alerts/events/alertevt_test123/acknowledge'
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_test123' }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.status).toBe('acknowledged');
    });

    it('returns 401 without authentication', async () => {
      mockVerifyApiKey.mockResolvedValue(null);

      const { PATCH } = await import('./[eventId]/acknowledge/route');
      const req = createUnauthRequest(
        'PATCH',
        '/api/v1/alerts/events/alertevt_test123/acknowledge'
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_test123' }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/alerts/events/:id/snooze', () => {
    it('snoozes with duration', async () => {
      const snoozed = {
        ...sampleEvent,
        snoozedUntil: new Date(Date.now() + 3600000),
        status: 'snoozed',
      };
      mockSnoozeAlertEvent.mockResolvedValueOnce(snoozed);

      const { PATCH } = await import('./[eventId]/snooze/route');
      const req = createAuthedRequest('PATCH', '/api/v1/alerts/events/alertevt_test123/snooze', {
        duration: 3600,
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_test123' }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.status).toBe('snoozed');
    });

    it('snoozes with absolute time', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const snoozed = {
        ...sampleEvent,
        snoozedUntil: futureDate,
        status: 'snoozed',
      };
      mockSnoozeAlertEvent.mockResolvedValueOnce(snoozed);

      const { PATCH } = await import('./[eventId]/snooze/route');
      const req = createAuthedRequest('PATCH', '/api/v1/alerts/events/alertevt_test123/snooze', {
        snoozedUntil: futureDate.toISOString(),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_test123' }),
      });

      expect(res.status).toBe(200);
    });

    it('returns 422 when both duration and snoozedUntil provided', async () => {
      const { PATCH } = await import('./[eventId]/snooze/route');
      const req = createAuthedRequest('PATCH', '/api/v1/alerts/events/alertevt_test123/snooze', {
        duration: 3600,
        snoozedUntil: new Date(Date.now() + 86400000).toISOString(),
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_test123' }),
      });

      expect(res.status).toBe(422);
    });

    it('returns 422 when neither provided', async () => {
      const { PATCH } = await import('./[eventId]/snooze/route');
      const req = createAuthedRequest('PATCH', '/api/v1/alerts/events/alertevt_test123/snooze', {});
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_test123' }),
      });

      expect(res.status).toBe(422);
    });

    it('returns 404 for non-existent event', async () => {
      mockSnoozeAlertEvent.mockResolvedValueOnce(null);

      const { PATCH } = await import('./[eventId]/snooze/route');
      const req = createAuthedRequest('PATCH', '/api/v1/alerts/events/alertevt_missing/snooze', {
        duration: 3600,
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_missing' }),
      });

      expect(res.status).toBe(404);
    });

    it('returns 401 without authentication', async () => {
      mockVerifyApiKey.mockResolvedValue(null);

      const { PATCH } = await import('./[eventId]/snooze/route');
      const req = createUnauthRequest('PATCH', '/api/v1/alerts/events/alertevt_test123/snooze');
      const res = await PATCH(req, {
        params: Promise.resolve({ eventId: 'alertevt_test123' }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/alerts/summary', () => {
    it('returns summary data', async () => {
      mockGetAlertSummary.mockResolvedValueOnce(sampleSummary);

      const { GET } = await import('../summary/route');
      const req = createAuthedRequest('GET', '/api/v1/alerts/summary');
      const res = await GET(req, { params: Promise.resolve({}) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.total).toBe(10);
      expect(data.data.bySeverity).toEqual({ info: 2, warning: 5, critical: 3 });
      expect(data.data.topRules).toHaveLength(1);
    });

    it('returns 401 without authentication', async () => {
      mockVerifyApiKey.mockResolvedValue(null);

      const { GET } = await import('../summary/route');
      const req = createUnauthRequest('GET', '/api/v1/alerts/summary');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(401);
    });

    it('passes date range to service', async () => {
      mockGetAlertSummary.mockResolvedValueOnce(sampleSummary);

      const { GET } = await import('../summary/route');
      const req = createAuthedRequest(
        'GET',
        '/api/v1/alerts/summary?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z'
      );
      await GET(req, { params: Promise.resolve({}) });

      expect(mockGetAlertSummary).toHaveBeenCalledWith('ws_123', {
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-31T23:59:59Z',
      });
    });
  });
});
