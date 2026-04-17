// ---------------------------------------------------------------------------
// Short-lived signed cookie carrying pending-OAuth state between the callback
// redirect and the property-selection POST.
//
// The cookie is HMAC-signed using BETTER_AUTH_SECRET so the client cannot
// forge it. Tokens are already AES-256-GCM-encrypted before being put into
// the cookie — the cookie layer only provides integrity, not confidentiality.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/config/env';
import { encryptCredential, decryptCredential } from '@/modules/adapters/adapter.crypto';
import type { EncryptedValue } from '@/modules/adapters/adapter.types';
import type { GoogleSite } from './gsc-oauth.service';

export const GSC_PENDING_COOKIE_NAME = 'quaynt_gsc_pending';
export const GSC_CSRF_COOKIE_NAME = 'quaynt_gsc_csrf';

const PENDING_MAX_AGE_SECONDS = 10 * 60;

interface PendingPayload {
  workspaceId: string;
  accessTokenEncrypted: EncryptedValue;
  refreshTokenEncrypted: EncryptedValue;
  tokenExpiresAt: number; // epoch ms
  scope: string;
  sites: GoogleSite[];
  issuedAt: number;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Buffer {
  const padded = str
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(str.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function sign(body: string): string {
  return b64url(createHmac('sha256', env.BETTER_AUTH_SECRET).update(body).digest());
}

export function buildPendingCookie(input: {
  workspaceId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scope: string;
  sites: GoogleSite[];
}): string {
  const payload: PendingPayload = {
    workspaceId: input.workspaceId,
    accessTokenEncrypted: encryptCredential(input.accessToken),
    refreshTokenEncrypted: encryptCredential(input.refreshToken),
    tokenExpiresAt: input.tokenExpiresAt.getTime(),
    scope: input.scope,
    sites: input.sites,
    issuedAt: Date.now(),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}.${sign(body)}`;
}

export interface VerifiedPending {
  workspaceId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scope: string;
  sites: GoogleSite[];
}

export function verifyPendingCookie(cookieValue: string): VerifiedPending {
  const parts = cookieValue.split('.');
  if (parts.length !== 2) throw new Error('Malformed pending cookie');
  const [body, sig] = parts;
  const expected = sign(body);
  const providedBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    throw new Error('Pending cookie signature mismatch');
  }
  const parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as PendingPayload;
  if (Date.now() - parsed.issuedAt > PENDING_MAX_AGE_SECONDS * 1000) {
    throw new Error('Pending cookie expired');
  }
  return {
    workspaceId: parsed.workspaceId,
    accessToken: decryptCredential(parsed.accessTokenEncrypted),
    refreshToken: decryptCredential(parsed.refreshTokenEncrypted),
    tokenExpiresAt: new Date(parsed.tokenExpiresAt),
    scope: parsed.scope,
    sites: parsed.sites,
  };
}

export const PENDING_COOKIE_MAX_AGE_SECONDS = PENDING_MAX_AGE_SECONDS;
