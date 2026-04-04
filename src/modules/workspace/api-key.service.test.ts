// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

vi.mock('@/lib/db', () => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockSet = vi.fn();

  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([
    {
      id: 'key_test123',
      name: 'Test Key',
      keyPrefix: 'qk_abcdefg',
      scopes: 'admin',
      expiresAt: null,
      createdAt: new Date(),
    },
  ]);
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: vi.fn().mockReturnValue([{ id: 'key_test123' }]) }),
  });

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      _mocks: {
        mockSelect,
        mockInsert,
        mockUpdate,
        mockFrom,
        mockWhere,
        mockLimit,
        mockValues,
        mockReturning,
        mockSet,
      },
    },
  };
});

vi.mock('./api-key.schema', () => ({
  apiKey: {
    id: 'id',
    workspaceId: 'workspaceId',
    name: 'name',
    keyHash: 'keyHash',
    keyPrefix: 'keyPrefix',
    scopes: 'scopes',
    lastUsedAt: 'lastUsedAt',
    expiresAt: 'expiresAt',
    revokedAt: 'revokedAt',
    createdAt: 'createdAt',
  },
}));

vi.mock('@/lib/api/types', () => ({}));

describe('API key service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('key format', () => {
    it('generates keys with qk_ prefix and 40 hex characters', async () => {
      const { generateApiKey } = await import('./api-key.service');
      const result = await generateApiKey('ws_123', 'Test', 'admin');

      expect(result.key).toMatch(/^qk_[a-f0-9]{40}$/);
    });

    it('generates unique keys', async () => {
      const { generateApiKey } = await import('./api-key.service');
      const result1 = await generateApiKey('ws_123', 'Key 1', 'admin');
      const result2 = await generateApiKey('ws_123', 'Key 2', 'admin');

      expect(result1.key).not.toBe(result2.key);
    });

    it('stores keyPrefix as first 11 characters', async () => {
      const { generateApiKey } = await import('./api-key.service');
      const result = await generateApiKey('ws_123', 'Test', 'admin');

      expect(result.key.slice(0, 11)).toMatch(/^qk_[a-f0-9]{8}$/);
    });
  });

  describe('key hashing', () => {
    it('produces deterministic SHA-256 hash', () => {
      const key = 'qk_1234567890abcdef1234567890abcdef12345678';
      const hash1 = createHash('sha256').update(key).digest('hex');
      const hash2 = createHash('sha256').update(key).digest('hex');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('verifyApiKey', () => {
    it('returns null for keys without qk_ prefix', async () => {
      const { verifyApiKey } = await import('./api-key.service');
      const result = await verifyApiKey('invalid_key');
      expect(result).toBeNull();
    });

    it('returns null when key not found in database', async () => {
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      mocks.mockLimit.mockReturnValueOnce([]);

      const { verifyApiKey } = await import('./api-key.service');
      const result = await verifyApiKey('qk_' + randomBytes(20).toString('hex'));
      expect(result).toBeNull();
    });

    it('returns null for revoked keys', async () => {
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      mocks.mockLimit.mockReturnValueOnce([
        {
          id: 'key_123',
          workspaceId: 'ws_123',
          scopes: 'admin',
          expiresAt: null,
          revokedAt: new Date(),
        },
      ]);

      const { verifyApiKey } = await import('./api-key.service');
      const result = await verifyApiKey('qk_' + randomBytes(20).toString('hex'));
      expect(result).toBeNull();
    });

    it('returns null for expired keys', async () => {
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      mocks.mockLimit.mockReturnValueOnce([
        {
          id: 'key_123',
          workspaceId: 'ws_123',
          scopes: 'admin',
          expiresAt: new Date('2020-01-01'),
          revokedAt: null,
        },
      ]);

      const { verifyApiKey } = await import('./api-key.service');
      const result = await verifyApiKey('qk_' + randomBytes(20).toString('hex'));
      expect(result).toBeNull();
    });

    it('returns record for valid key', async () => {
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      mocks.mockLimit.mockReturnValueOnce([
        {
          id: 'key_123',
          workspaceId: 'ws_123',
          scopes: 'admin',
          expiresAt: null,
          revokedAt: null,
        },
      ]);

      const { verifyApiKey } = await import('./api-key.service');
      const result = await verifyApiKey('qk_' + randomBytes(20).toString('hex'));
      expect(result).toEqual({
        id: 'key_123',
        workspaceId: 'ws_123',
        scopes: 'admin',
      });
    });
  });
});
