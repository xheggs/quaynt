import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '@/lib/config/env';
import type { EncryptedValue } from './adapter.types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const CURRENT_KEY_VERSION = 1;

function getEncryptionKey(): Buffer {
  const hex = env.ADAPTER_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('Adapter encryption key is not configured');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptCredential(plaintext: string): EncryptedValue {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

export function decryptCredential(encrypted: EncryptedValue): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encrypted.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
