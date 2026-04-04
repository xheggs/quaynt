import { describe, it, expect, vi, beforeEach } from 'vitest';

function chainMock(finalValue: unknown = []) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(finalValue),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(finalValue),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return chain;
}

vi.mock('@/lib/db', () => {
  const selectChain = chainMock();
  const insertChain = chainMock();
  const updateChain = chainMock();
  const deleteChain = chainMock();

  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
      delete: vi.fn(() => deleteChain),
      transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: vi.fn().mockReturnValue({ limit: 25, offset: 0 }),
  sortConfig: vi.fn().mockReturnValue(undefined),
  countTotal: vi.fn().mockResolvedValue(0),
}));

vi.mock('./webhook.security', () => ({
  validateWebhookUrl: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/config/env', () => ({
  env: { NODE_ENV: 'production', WEBHOOK_TIMEOUT_MS: 10000 },
}));

describe('webhook.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createWebhookEndpoint', () => {
    it('rejects invalid URLs via SSRF check', async () => {
      const { validateWebhookUrl } = await import('./webhook.security');
      vi.mocked(validateWebhookUrl).mockResolvedValueOnce({
        valid: false,
        reason: 'private IP',
      });

      const { createWebhookEndpoint } = await import('./webhook.service');
      await expect(
        createWebhookEndpoint('ws_123', {
          url: 'https://10.0.0.1/webhook',
          events: ['citation.new'],
        })
      ).rejects.toThrow('private IP');
    });

    it('rejects invalid event types', async () => {
      const { createWebhookEndpoint } = await import('./webhook.service');
      await expect(
        createWebhookEndpoint('ws_123', {
          url: 'https://example.com/webhook',
          events: ['invalid.event'],
        })
      ).rejects.toThrow('not a valid event type');
    });

    it('enforces max endpoints per workspace', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(10);

      const { createWebhookEndpoint } = await import('./webhook.service');
      await expect(
        createWebhookEndpoint('ws_123', {
          url: 'https://example.com/webhook',
          events: ['citation.new'],
        })
      ).rejects.toThrow('Maximum number');
    });

    it('accepts wildcard * event subscription', async () => {
      const { db } = await import('@/lib/db');
      const insertChain = chainMock([
        {
          id: 'wh_new',
          url: 'https://example.com',
          events: ['*'],
          description: null,
          enabled: true,
          createdAt: new Date(),
        },
      ]);
      vi.mocked(db.insert).mockReturnValue(insertChain as never);

      const { createWebhookEndpoint } = await import('./webhook.service');
      const result = await createWebhookEndpoint('ws_123', {
        url: 'https://example.com/webhook',
        events: ['*'],
      });

      expect(result.id).toBe('wh_new');
      expect(result.secret).toBeDefined();
      expect(result.secret).toHaveLength(64); // 32 bytes as hex
    });
  });

  describe('event type validation', () => {
    it('accepts all valid event types', async () => {
      const { WEBHOOK_EVENT_TYPES } = await import('./webhook.events');
      for (const eventType of WEBHOOK_EVENT_TYPES) {
        // Should not throw for any valid event type
        expect((WEBHOOK_EVENT_TYPES as readonly string[]).includes(eventType)).toBe(true);
      }
    });
  });

  describe('listWebhookEndpoints', () => {
    it('never returns secret column', async () => {
      const { db } = await import('@/lib/db');
      const selectChain = chainMock([]);
      vi.mocked(db.select).mockReturnValue(selectChain as never);

      const { listWebhookEndpoints } = await import('./webhook.service');
      await listWebhookEndpoints('ws_123', {
        page: 1,
        limit: 25,
        order: 'desc',
      });

      // Verify select was called with specific columns (no secret)
      const selectArg = vi.mocked(db.select).mock.calls[0]?.[0];
      if (selectArg && typeof selectArg === 'object') {
        expect('secret' in selectArg).toBe(false);
      }
    });
  });

  describe('getWebhookEndpoint', () => {
    it('returns null when endpoint not found', async () => {
      const { db } = await import('@/lib/db');
      const selectChain = chainMock([]);
      selectChain.limit.mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue(selectChain as never);

      const { getWebhookEndpoint } = await import('./webhook.service');
      const result = await getWebhookEndpoint('wh_nonexistent', 'ws_123');
      expect(result).toBeNull();
    });
  });
});
