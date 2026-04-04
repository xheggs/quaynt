import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailMessage, EmailResult } from './email.types';
import { env } from '@/lib/config/env';

const PERMANENT_ERROR_CODES = new Set([
  'EENVELOPE', // invalid envelope (bad address format)
]);

export class SmtpTransport {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_TLS,
      pool: true,
      ...(env.SMTP_USER && env.SMTP_PASS
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
        : {}),
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: message.from ?? env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        permanent: code ? PERMANENT_ERROR_CODES.has(code) : false,
      };
    }
  }

  async close(): Promise<void> {
    this.transporter.close();
  }
}
