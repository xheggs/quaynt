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
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    EMAIL_ENABLED: true,
    EMAIL_FROM: 'Quaynt <notifications@quaynt.com>',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_TLS: false,
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

const mockTransport = {
  send: vi.fn().mockResolvedValue({ success: true, messageId: 'msg_1' }),
  close: vi.fn(),
};

vi.mock('./email/email.transport', () => ({
  createEmailTransport: vi.fn(() => mockTransport),
}));

vi.mock('./notification.service', () => ({
  getPreferencesForWorkspace: vi.fn().mockResolvedValue([]),
  renderDigestEmail: vi.fn().mockResolvedValue({
    subject: 'Digest',
    html: '<html>digest</html>',
    text: 'digest',
    headers: {},
  }),
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>test</html>'),
  toPlainText: vi.fn().mockResolvedValue('test plain text'),
}));

describe('notification.handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerNotificationHandlers', () => {
    it('registers all jobs and schedules crons', async () => {
      const { registerNotificationHandlers } = await import('./notification.handler');

      const boss = {
        work: vi.fn().mockResolvedValue(undefined),
        schedule: vi.fn().mockResolvedValue(undefined),
      } as unknown as Parameters<typeof registerNotificationHandlers>[0];

      await registerNotificationHandlers(boss);

      // Should register 4 workers
      expect(boss.work).toHaveBeenCalledTimes(4);
      expect(boss.work).toHaveBeenCalledWith(
        'email-send',
        expect.any(Object),
        expect.any(Function)
      );
      expect(boss.work).toHaveBeenCalledWith(
        'email-digest-hourly',
        expect.any(Object),
        expect.any(Function)
      );
      expect(boss.work).toHaveBeenCalledWith(
        'email-digest-daily',
        expect.any(Object),
        expect.any(Function)
      );
      expect(boss.work).toHaveBeenCalledWith(
        'email-digest-weekly',
        expect.any(Object),
        expect.any(Function)
      );

      // Should schedule 3 crons
      expect(boss.schedule).toHaveBeenCalledTimes(3);
      expect(boss.schedule).toHaveBeenCalledWith('email-digest-hourly', '0 * * * *', {});
      expect(boss.schedule).toHaveBeenCalledWith('email-digest-daily', '0 * * * *', {});
      expect(boss.schedule).toHaveBeenCalledWith('email-digest-weekly', '0 * * * *', {});
    });
  });

  describe('email-send job', () => {
    it('sends email and updates notification log on success', async () => {
      const { registerNotificationHandlers } = await import('./notification.handler');
      const { db } = await import('@/lib/db');

      const boss = {
        work: vi.fn().mockResolvedValue(undefined),
        schedule: vi.fn().mockResolvedValue(undefined),
      } as unknown as Parameters<typeof registerNotificationHandlers>[0];

      await registerNotificationHandlers(boss);

      // Get the email-send handler
      const emailSendCall = boss.work.mock.calls.find(
        (call: unknown[]) => call[0] === 'email-send'
      );
      const handler = emailSendCall[2];

      // Call the handler with a job
      await handler([
        {
          data: {
            notificationLogId: 'notiflog_1',
            recipientEmail: 'user@example.com',
            subject: 'Test Alert',
            html: '<p>Alert</p>',
            text: 'Alert',
            headers: { 'List-Unsubscribe': '<http://example.com>' },
          },
          retryCount: 0,
        },
      ]);

      expect(mockTransport.send).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Test Alert',
        html: '<p>Alert</p>',
        text: 'Alert',
        headers: { 'List-Unsubscribe': '<http://example.com>' },
      });

      // Should update notification log to sent
      expect(db.update).toHaveBeenCalled();
    });

    it('marks as failed on permanent error without throwing', async () => {
      mockTransport.send.mockResolvedValueOnce({
        success: false,
        error: 'Invalid email',
        permanent: true,
      });

      const { registerNotificationHandlers } = await import('./notification.handler');

      const boss = {
        work: vi.fn().mockResolvedValue(undefined),
        schedule: vi.fn().mockResolvedValue(undefined),
      } as unknown as Parameters<typeof registerNotificationHandlers>[0];

      await registerNotificationHandlers(boss);

      const emailSendCall = boss.work.mock.calls.find(
        (call: unknown[]) => call[0] === 'email-send'
      );
      const handler = emailSendCall[2];

      // Should not throw for permanent failures
      await expect(
        handler([
          {
            data: {
              notificationLogId: 'notiflog_1',
              recipientEmail: 'invalid',
              subject: 'Test',
              html: '<p>test</p>',
              text: 'test',
            },
            retryCount: 0,
          },
        ])
      ).resolves.not.toThrow();
    });

    it('throws on transient error to trigger retry', async () => {
      mockTransport.send.mockResolvedValueOnce({
        success: false,
        error: 'Connection refused',
        permanent: false,
      });

      const { registerNotificationHandlers } = await import('./notification.handler');

      const boss = {
        work: vi.fn().mockResolvedValue(undefined),
        schedule: vi.fn().mockResolvedValue(undefined),
      } as unknown as Parameters<typeof registerNotificationHandlers>[0];

      await registerNotificationHandlers(boss);

      const emailSendCall = boss.work.mock.calls.find(
        (call: unknown[]) => call[0] === 'email-send'
      );
      const handler = emailSendCall[2];

      await expect(
        handler([
          {
            data: {
              notificationLogId: 'notiflog_1',
              recipientEmail: 'user@example.com',
              subject: 'Test',
              html: '<p>test</p>',
              text: 'test',
            },
            retryCount: 0,
          },
        ])
      ).rejects.toThrow('Connection refused');
    });
  });
});
