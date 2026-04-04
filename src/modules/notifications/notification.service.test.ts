import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgBoss } from 'pg-boss';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    EMAIL_ENABLED: false,
    EMAIL_FROM: 'Quaynt <notifications@quaynt.com>',
    SMTP_HOST: undefined,
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock('./email/email.transport', () => ({
  createEmailTransport: vi.fn().mockReturnValue(null),
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>test</html>'),
  toPlainText: vi.fn().mockResolvedValue('test plain text'),
}));

describe('notification.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateUnsubscribeToken / validateUnsubscribeToken', () => {
    it('round-trips a token successfully', async () => {
      const { generateUnsubscribeToken, validateUnsubscribeToken } =
        await import('./notification.service');

      const token = generateUnsubscribeToken('user_123', 'ws_456');
      expect(token).toContain('.');

      // Mock workspace membership check
      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'wm_1' }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await validateUnsubscribeToken(token);
      expect(result).toEqual({
        valid: true,
        userId: 'user_123',
        workspaceId: 'ws_456',
        channel: 'email',
      });
    });

    it('rejects a tampered token', async () => {
      const { validateUnsubscribeToken } = await import('./notification.service');
      const result = await validateUnsubscribeToken('tampered.invalid');
      expect(result).toEqual({ valid: false, error: 'INVALID_TOKEN' });
    });

    it('rejects a token without a dot separator', async () => {
      const { validateUnsubscribeToken } = await import('./notification.service');
      const result = await validateUnsubscribeToken('notokenhere');
      expect(result).toEqual({ valid: false, error: 'INVALID_TOKEN' });
    });

    it('returns NOT_MEMBER when user is not in workspace', async () => {
      const { generateUnsubscribeToken, validateUnsubscribeToken } =
        await import('./notification.service');

      const token = generateUnsubscribeToken('user_123', 'ws_456');

      const { db } = await import('@/lib/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await validateUnsubscribeToken(token);
      expect(result).toEqual({ valid: false, error: 'NOT_MEMBER' });
    });
  });

  describe('dispatchAlertEmail', () => {
    it('is a no-op when email is not enabled', async () => {
      const { dispatchAlertEmail } = await import('./notification.service');
      const { createEmailTransport } = await import('./email/email.transport');
      vi.mocked(createEmailTransport).mockReturnValue(null);

      const boss = { send: vi.fn() } as unknown as PgBoss;
      await dispatchAlertEmail(
        {
          id: 'alertevt_1',
          workspaceId: 'ws_1',
          severity: 'warning',
          metricValue: '0.5',
          previousValue: '0.8',
          threshold: '0.6',
          condition: 'drops_below',
          scopeSnapshot: { brandId: 'brand_1', brandName: 'TestBrand' },
          triggeredAt: new Date(),
          alertRuleId: 'alert_1',
        },
        { id: 'alert_1', name: 'Test Rule', metric: 'recommendation_share', severity: 'warning' },
        boss
      );

      expect(boss.send).not.toHaveBeenCalled();
    });
  });
});
