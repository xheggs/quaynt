import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    REPORT_STORAGE_PATH: '/tmp/reports',
  },
}));

const mockChildLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
};
mockChildLogger.child.mockReturnValue(mockChildLogger);

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => mockChildLogger),
    debug: vi.fn(),
    info: vi.fn(),
  },
  setRequestLogger: vi.fn(),
  getRequestLogger: vi.fn(() => mockChildLogger),
}));

// Mock auth middleware to pass through
vi.mock('@/lib/api/middleware', () => {
  const authContext = {
    method: 'session',
    userId: 'usr_test',
    sessionId: 'ses_test',
    workspaceId: 'ws_test',
    scopes: ['admin'],
  };
  return {
    withAuth: vi.fn((handler) => handler),
    withScope: vi.fn((handler) => handler),
    getAuthContext: vi.fn(() => authContext),
  };
});

vi.mock('@/lib/api/rate-limit', () => ({
  withRateLimit: vi.fn((handler) => handler),
}));

vi.mock('@/lib/api/request-id', () => ({
  withRequestId: vi.fn((handler) => handler),
}));

vi.mock('@/lib/api/request-log', () => ({
  withRequestLog: vi.fn((handler) => handler),
}));

const mockCreateSchedule = vi.fn();
const mockListSchedules = vi.fn().mockResolvedValue({ items: [], total: 0 });
const mockGetSchedule = vi.fn();
const mockUpdateSchedule = vi.fn();
const mockDeleteSchedule = vi.fn();

vi.mock('@/modules/scheduled-reports/scheduled-report.service', () => ({
  createSchedule: (...args: unknown[]) => mockCreateSchedule(...args),
  listSchedules: (...args: unknown[]) => mockListSchedules(...args),
  getSchedule: (...args: unknown[]) => mockGetSchedule(...args),
  updateSchedule: (...args: unknown[]) => mockUpdateSchedule(...args),
  deleteSchedule: (...args: unknown[]) => mockDeleteSchedule(...args),
  triggerSchedule: vi.fn().mockResolvedValue(true),
  listDeliveries: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  unsubscribeRecipient: vi.fn().mockResolvedValue('success'),
}));

vi.mock('@/lib/jobs/boss', () => ({
  createBoss: vi.fn(() => ({
    send: vi.fn().mockResolvedValue('job-id'),
  })),
}));

describe('reports/schedules API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/reports/schedules', () => {
    it('returns paginated schedules', async () => {
      mockListSchedules.mockResolvedValue({
        items: [{ id: 'sched_1', name: 'Weekly Report' }],
        total: 1,
      });

      const { GET } = await import('./route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules');
      const res = await GET(req, { params: Promise.resolve({}) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.data).toHaveLength(1);
      expect(body.data.meta.total).toBe(1);
    });
  });

  describe('POST /api/v1/reports/schedules', () => {
    it('creates a schedule with valid input', async () => {
      const newSchedule = {
        id: 'sched_test',
        name: 'Weekly Report',
        frequency: 'weekly',
        recipients: [{ id: 'schrcpt_1', type: 'email', address: 'test@example.com' }],
      };
      mockCreateSchedule.mockResolvedValue(newSchedule);

      const { POST } = await import('./route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Weekly Report',
          frequency: 'weekly',
          hour: 9,
          dayOfWeek: 1,
          timezone: 'UTC',
          format: 'pdf',
          scope: {
            promptSetId: 'ps_test',
            brandIds: ['brand_test'],
            periodDays: 7,
          },
          recipients: [{ type: 'email', address: 'test@example.com' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.data.name).toBe('Weekly Report');
    });

    it('returns 422 for invalid input', async () => {
      const { POST } = await import('./route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(422);
    });

    it('returns 409 when schedule limit exceeded', async () => {
      mockCreateSchedule.mockRejectedValue(new Error('SCHEDULE_LIMIT_EXCEEDED'));

      const { POST } = await import('./route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test',
          frequency: 'daily',
          hour: 9,
          timezone: 'UTC',
          format: 'pdf',
          scope: { promptSetId: 'ps_1', brandIds: ['br_1'], periodDays: 7 },
          recipients: [{ type: 'email', address: 'test@example.com' }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/reports/schedules/:scheduleId', () => {
    it('returns schedule with recipients and deliveries', async () => {
      mockGetSchedule.mockResolvedValue({
        id: 'sched_1',
        name: 'Weekly Report',
        recipients: [{ id: 'schrcpt_1', type: 'email', address: 'test@example.com' }],
        recentDeliveries: [],
      });

      const { GET } = await import('./[scheduleId]/route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules/sched_1');
      const res = await GET(req, { params: Promise.resolve({ scheduleId: 'sched_1' }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe('sched_1');
      expect(body.data.recipients).toHaveLength(1);
    });

    it('returns 404 for non-existent schedule', async () => {
      mockGetSchedule.mockResolvedValue(null);

      const { GET } = await import('./[scheduleId]/route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules/sched_999');
      const res = await GET(req, { params: Promise.resolve({ scheduleId: 'sched_999' }) });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/reports/schedules/:scheduleId', () => {
    it('updates schedule name', async () => {
      mockUpdateSchedule.mockResolvedValue({
        id: 'sched_1',
        name: 'Updated Name',
        recipients: [],
      });

      const { PATCH } = await import('./[scheduleId]/route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules/sched_1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Name' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await PATCH(req, { params: Promise.resolve({ scheduleId: 'sched_1' }) });
      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent schedule', async () => {
      mockUpdateSchedule.mockResolvedValue(null);

      const { PATCH } = await import('./[scheduleId]/route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules/sched_999', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await PATCH(req, { params: Promise.resolve({ scheduleId: 'sched_999' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/reports/schedules/:scheduleId', () => {
    it('soft deletes a schedule', async () => {
      mockDeleteSchedule.mockResolvedValue(true);

      const { DELETE } = await import('./[scheduleId]/route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules/sched_1', {
        method: 'DELETE',
      });

      const res = await DELETE(req, { params: Promise.resolve({ scheduleId: 'sched_1' }) });
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent schedule', async () => {
      mockDeleteSchedule.mockResolvedValue(false);

      const { DELETE } = await import('./[scheduleId]/route');
      const req = new NextRequest('http://localhost:3000/api/v1/reports/schedules/sched_999', {
        method: 'DELETE',
      });

      const res = await DELETE(req, { params: Promise.resolve({ scheduleId: 'sched_999' }) });
      expect(res.status).toBe(404);
    });
  });
});
