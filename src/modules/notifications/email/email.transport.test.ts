import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  env: {
    EMAIL_ENABLED: false,
    EMAIL_FROM: 'Quaynt <notifications@quaynt.com>',
    SMTP_HOST: undefined,
    SMTP_PORT: 587,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
    SMTP_TLS: false,
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      close: vi.fn(),
    })),
  },
}));

describe('email transport', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('createEmailTransport', () => {
    it('returns null when EMAIL_ENABLED is false', async () => {
      const { env } = await import('@/lib/config/env');
      Object.assign(env, { EMAIL_ENABLED: false });

      const { createEmailTransport } = await import('./email.transport');
      const transport = createEmailTransport();
      expect(transport).toBeNull();
    });

    it('returns SmtpTransport when EMAIL_ENABLED is true and SMTP_HOST is set', async () => {
      const { env } = await import('@/lib/config/env');
      Object.assign(env, { EMAIL_ENABLED: true, SMTP_HOST: 'smtp.example.com' });

      const { createEmailTransport } = await import('./email.transport');
      const transport = createEmailTransport();
      expect(transport).not.toBeNull();
    });

    it('throws when EMAIL_ENABLED is true but SMTP_HOST is missing', async () => {
      const { env } = await import('@/lib/config/env');
      Object.assign(env, { EMAIL_ENABLED: true, SMTP_HOST: undefined });

      const { createEmailTransport } = await import('./email.transport');
      expect(() => createEmailTransport()).toThrow('SMTP_HOST is required');
    });
  });

  describe('SmtpTransport', () => {
    it('sends an email successfully', async () => {
      const { env } = await import('@/lib/config/env');
      Object.assign(env, {
        EMAIL_ENABLED: true,
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_TLS: false,
      });

      const { SmtpTransport } = await import('./email.smtp');
      const transport = new SmtpTransport();
      const result = await transport.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('returns failure result on send error', async () => {
      const nodemailer = await import('nodemailer');
      vi.mocked(nodemailer.default.createTransport).mockReturnValueOnce({
        sendMail: vi.fn().mockRejectedValue(new Error('Connection refused')),
        close: vi.fn(),
      } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

      const { env } = await import('@/lib/config/env');
      Object.assign(env, { SMTP_HOST: 'smtp.example.com' });

      const { SmtpTransport } = await import('./email.smtp');
      const transport = new SmtpTransport();
      const result = await transport.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('marks EENVELOPE errors as permanent', async () => {
      const envelopeError = new Error('Invalid address') as NodeJS.ErrnoException;
      envelopeError.code = 'EENVELOPE';

      const nodemailer = await import('nodemailer');
      vi.mocked(nodemailer.default.createTransport).mockReturnValueOnce({
        sendMail: vi.fn().mockRejectedValue(envelopeError),
        close: vi.fn(),
      } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

      const { env } = await import('@/lib/config/env');
      Object.assign(env, { SMTP_HOST: 'smtp.example.com' });

      const { SmtpTransport } = await import('./email.smtp');
      const transport = new SmtpTransport();
      const result = await transport.send({
        to: 'invalid',
        subject: 'Test',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.permanent).toBe(true);
    });
  });
});
