import { env } from '@/lib/config/env';
import { SmtpTransport } from './email.smtp';

let transport: SmtpTransport | null = null;
let initialized = false;

export function createEmailTransport(): SmtpTransport | null {
  if (initialized) return transport;
  initialized = true;

  if (!env.EMAIL_ENABLED) {
    return null;
  }

  if (!env.SMTP_HOST) {
    throw new Error('SMTP_HOST is required when EMAIL_ENABLED=true');
  }

  transport = new SmtpTransport();
  return transport;
}
