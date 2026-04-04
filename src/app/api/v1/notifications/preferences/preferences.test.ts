import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'notifpref_1', enabled: true }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/db/pool', () => ({
  pool: {},
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    RATE_LIMIT_POINTS: 100,
    RATE_LIMIT_DURATION: 60,
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
    warn: vi.fn(),
  },
  setRequestLogger: vi.fn(),
  getRequestLogger: vi.fn(() => mockChildLogger),
}));

const mockGetOrCreate = vi.fn().mockResolvedValue({
  id: 'notifpref_1',
  enabled: true,
  digestFrequency: 'immediate',
});
const mockUpdate = vi.fn().mockResolvedValue({
  id: 'notifpref_1',
  enabled: false,
  digestFrequency: 'daily',
});
const mockGetOrCreateWorkspace = vi.fn().mockResolvedValue({
  id: 'notifpref_ws_1',
  enabled: true,
  severityFilter: ['info', 'warning', 'critical'],
});
const mockUpdateWorkspace = vi.fn().mockResolvedValue({
  id: 'notifpref_ws_1',
  enabled: false,
});

vi.mock('@/modules/notifications/notification.service', () => ({
  getOrCreatePreference: (...args: unknown[]) => mockGetOrCreate(...args),
  updatePreference: (...args: unknown[]) => mockUpdate(...args),
  getOrCreateWorkspacePreference: (...args: unknown[]) => mockGetOrCreateWorkspace(...args),
  updateWorkspacePreference: (...args: unknown[]) => mockUpdateWorkspace(...args),
}));

vi.mock('@/lib/api/middleware', () => ({
  withAuth: (handler: (...args: unknown[]) => unknown) => handler,
  withScope: (handler: (...args: unknown[]) => unknown) => handler,
  getAuthContext: vi.fn(() => ({
    method: 'session',
    userId: 'usr_1',
    workspaceId: 'ws_1',
    scopes: ['read', 'read-write'],
  })),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown) => handler,
}));

describe('notification preferences API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns preferences for the current user', async () => {
      const { GET } = await import('./route');

      const req = new Request(
        'http://localhost:3000/api/v1/notifications/preferences'
      ) as unknown as { nextUrl: URL };
      req.nextUrl = new URL('http://localhost:3000/api/v1/notifications/preferences');

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.email).toBeDefined();
      expect(body.data.webhook).toBeDefined();
      expect(mockGetOrCreate).toHaveBeenCalledWith('ws_1', 'usr_1', 'email');
      expect(mockGetOrCreateWorkspace).toHaveBeenCalledWith('ws_1', 'webhook');
    });
  });

  describe('PATCH', () => {
    it('updates preferences with valid input', async () => {
      const { PATCH } = await import('./route');

      const req = new Request('http://localhost:3000/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: { enabled: false, digestFrequency: 'daily' },
        }),
      }) as unknown as { nextUrl: URL };
      req.nextUrl = new URL('http://localhost:3000/api/v1/notifications/preferences');

      const res = await PATCH(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      expect(mockUpdate).toHaveBeenCalledWith('ws_1', 'usr_1', 'email', {
        enabled: false,
        digestFrequency: 'daily',
      });
    });
  });
});
