// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 256 bits

vi.mock('@/lib/config/env', () => ({
  env: {
    ADAPTER_ENCRYPTION_KEY: TEST_KEY,
  },
}));

describe('adapter crypto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encrypts and decrypts a credential roundtrip', async () => {
    const { encryptCredential, decryptCredential } = await import('./adapter.crypto');
    const plaintext = '{"apiKey":"sk-test-12345"}';

    const encrypted = encryptCredential(plaintext);
    const decrypted = decryptCredential(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (IV uniqueness)', async () => {
    const { encryptCredential } = await import('./adapter.crypto');
    const plaintext = 'same-secret';

    const a = encryptCredential(plaintext);
    const b = encryptCredential(plaintext);

    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it('includes keyVersion in encrypted value', async () => {
    const { encryptCredential } = await import('./adapter.crypto');
    const encrypted = encryptCredential('test');

    expect(encrypted.keyVersion).toBe(1);
  });

  it('returns hex-encoded fields', async () => {
    const { encryptCredential } = await import('./adapter.crypto');
    const encrypted = encryptCredential('test');

    expect(encrypted.ciphertext).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.tag).toMatch(/^[0-9a-f]+$/);
  });

  it('detects tampered ciphertext', async () => {
    const { encryptCredential, decryptCredential } = await import('./adapter.crypto');
    const encrypted = encryptCredential('secret');

    // Tamper with ciphertext
    const tampered = {
      ...encrypted,
      ciphertext: 'ff' + encrypted.ciphertext.slice(2),
    };

    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('detects tampered auth tag', async () => {
    const { encryptCredential, decryptCredential } = await import('./adapter.crypto');
    const encrypted = encryptCredential('secret');

    const tampered = {
      ...encrypted,
      tag: 'ff' + encrypted.tag.slice(2),
    };

    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('throws when encryption key is not configured', async () => {
    const { env } = await import('@/lib/config/env');
    const original = env.ADAPTER_ENCRYPTION_KEY;

    // Temporarily remove key
    Object.defineProperty(env, 'ADAPTER_ENCRYPTION_KEY', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { encryptCredential } = await import('./adapter.crypto');

    expect(() => encryptCredential('test')).toThrow('Adapter encryption key is not configured');

    // Restore
    Object.defineProperty(env, 'ADAPTER_ENCRYPTION_KEY', {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});
