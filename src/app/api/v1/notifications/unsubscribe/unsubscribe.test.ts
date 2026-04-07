import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
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

const mockValidateToken = vi.fn();
const mockUpdatePreference = vi.fn();

vi.mock('@/modules/notifications/notification.service', () => ({
  validateUnsubscribeToken: (...args: unknown[]) => mockValidateToken(...args),
  updatePreference: (...args: unknown[]) => mockUpdatePreference(...args),
}));

describe('unsubscribe endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 400 when no token provided', async () => {
      const { GET } = await import('./route');
      const req = new NextRequest('http://localhost:3000/api/v1/notifications/unsubscribe');

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });

    it('returns success for valid token', async () => {
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 'usr_1',
        workspaceId: 'ws_1',
        channel: 'email',
      });

      const { GET } = await import('./route');
      const url = 'http://localhost:3000/api/v1/notifications/unsubscribe?token=valid';
      const req = new NextRequest(url);

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.userId).toBe('usr_1');
    });

    it('returns 400 for invalid token', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
        error: 'INVALID_TOKEN',
      });

      const { GET } = await import('./route');
      const url = 'http://localhost:3000/api/v1/notifications/unsubscribe?token=bad';
      const req = new NextRequest(url);

      const res = await GET(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });
  });

  describe('POST', () => {
    it('disables email preference for valid token', async () => {
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 'usr_1',
        workspaceId: 'ws_1',
        channel: 'email',
      });

      const { POST } = await import('./route');
      const url = 'http://localhost:3000/api/v1/notifications/unsubscribe?token=valid';
      const req = new NextRequest(url, { method: 'POST' });

      const res = await POST(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      expect(mockUpdatePreference).toHaveBeenCalledWith('ws_1', 'usr_1', 'email', {
        enabled: false,
      });
    });
  });
});
