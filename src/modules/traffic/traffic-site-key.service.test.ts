// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn();
  const mockOffset = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockSet = vi.fn();

  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy });
  mockLimit.mockReturnValue([]);
  mockOrderBy.mockReturnValue({ limit: vi.fn().mockReturnValue({ offset: mockOffset }) });
  mockOffset.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([
    {
      id: 'tsk_test123',
      name: 'Test Key',
      keyPrefix: 'tsk_abcdefg',
      status: 'active',
      allowedOrigins: [],
      createdAt: new Date(),
    },
  ]);
  const defaultSetChain = {
    where: vi.fn().mockReturnValue({ returning: vi.fn().mockReturnValue([{ id: 'tsk_test123' }]) }),
  };
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue(defaultSetChain);

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
        mockOrderBy,
        mockOffset,
        mockValues,
        mockReturning,
        mockSet,
      },
    },
  };
});

vi.mock('./traffic-site-key.schema', () => ({
  trafficSiteKey: {
    id: 'id',
    workspaceId: 'workspaceId',
    name: 'name',
    keyHash: 'keyHash',
    keyPrefix: 'keyPrefix',
    status: 'status',
    allowedOrigins: 'allowedOrigins',
    lastUsedAt: 'lastUsedAt',
    createdAt: 'createdAt',
    revokedAt: 'revokedAt',
  },
}));

vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: ({ page, limit }: { page: number; limit: number }) => ({
    limit,
    offset: (page - 1) * limit,
  }),
  sortConfig: () => undefined,
  countTotal: vi.fn().mockResolvedValue(0),
}));

describe('traffic site key service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { __resetDebounceForTests } = await import('./traffic-site-key.service');
    __resetDebounceForTests();
  });

  describe('key format', () => {
    it('generates keys with tsk_ prefix and 32 hex characters', async () => {
      const { createSiteKey } = await import('./traffic-site-key.service');
      const result = await createSiteKey({ workspaceId: 'ws_123', name: 'Test' });
      expect(result.plaintextKey).toMatch(/^tsk_[a-f0-9]{32}$/);
    });

    it('generates unique keys', async () => {
      const { createSiteKey } = await import('./traffic-site-key.service');
      const a = await createSiteKey({ workspaceId: 'ws_123', name: 'a' });
      const b = await createSiteKey({ workspaceId: 'ws_123', name: 'b' });
      expect(a.plaintextKey).not.toBe(b.plaintextKey);
    });

    it('keyPrefix is 11 chars (tsk_ + 7 hex)', async () => {
      const { createSiteKey } = await import('./traffic-site-key.service');
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      await createSiteKey({ workspaceId: 'ws_123', name: 'Test' });
      const insertCall = mocks.mockValues.mock.calls[0][0] as {
        keyPrefix: string;
      };
      expect(insertCall.keyPrefix).toMatch(/^tsk_[a-f0-9]{7}$/);
    });

    it('normalizes allowedOrigins (trim + strip trailing slash)', async () => {
      const { createSiteKey } = await import('./traffic-site-key.service');
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      await createSiteKey({
        workspaceId: 'ws_123',
        name: 'Test',
        allowedOrigins: ['  https://acme.com/  ', 'https://www.acme.com', ''],
      });
      const insertCall = mocks.mockValues.mock.calls[0][0] as {
        allowedOrigins: string[];
      };
      expect(insertCall.allowedOrigins).toEqual(['https://acme.com', 'https://www.acme.com']);
    });
  });

  describe('getSiteKeyByPlaintext', () => {
    it('rejects keys without tsk_ prefix without querying DB', async () => {
      const { getSiteKeyByPlaintext } = await import('./traffic-site-key.service');
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      mocks.mockSelect.mockClear();
      const result = await getSiteKeyByPlaintext('invalid_key');
      expect(result).toBeNull();
      expect(mocks.mockSelect).not.toHaveBeenCalled();
    });

    it('returns null for revoked keys', async () => {
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      mocks.mockLimit.mockReturnValueOnce([
        {
          id: 'tsk_abc',
          workspaceId: 'ws_123',
          status: 'revoked',
          allowedOrigins: [],
        },
      ]);
      const { getSiteKeyByPlaintext } = await import('./traffic-site-key.service');
      const result = await getSiteKeyByPlaintext('tsk_' + 'a'.repeat(32));
      expect(result).toBeNull();
    });

    it('returns workspace + allowedOrigins for active keys', async () => {
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      mocks.mockLimit.mockReturnValueOnce([
        {
          id: 'tsk_abc',
          workspaceId: 'ws_123',
          status: 'active',
          allowedOrigins: ['https://acme.com'],
        },
      ]);
      const { getSiteKeyByPlaintext } = await import('./traffic-site-key.service');
      const result = await getSiteKeyByPlaintext('tsk_' + 'a'.repeat(32));
      expect(result).toEqual({
        id: 'tsk_abc',
        workspaceId: 'ws_123',
        allowedOrigins: ['https://acme.com'],
      });
    });

    it('debounces lastUsedAt writes: 100 calls within 10s produce at most 2 writes', async () => {
      const { db } = await import('@/lib/db');
      const mocks = (db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        ._mocks;
      // Each DB select lookup must return a matching record.
      mocks.mockLimit.mockReturnValue([
        {
          id: 'tsk_debounce',
          workspaceId: 'ws_1',
          status: 'active',
          allowedOrigins: [],
        },
      ]);
      // Stub the update chain — .where() must be awaitable (returns a resolved thenable).
      const updateSetChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      mocks.mockSet.mockReturnValue(updateSetChain);

      const { getSiteKeyByPlaintext } = await import('./traffic-site-key.service');

      // Call 100 times in rapid succession (no time elapsing in a tight loop).
      for (let i = 0; i < 100; i++) {
        await getSiteKeyByPlaintext('tsk_' + 'a'.repeat(32));
      }
      // At most 1 write in this tight window (the first call wins).
      // Allow up to 2 to be forgiving if the clock ticks past 60s (it won't).
      expect(mocks.mockUpdate.mock.calls.length).toBeLessThanOrEqual(2);
    });
  });
});
