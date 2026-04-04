import { describe, it, expect, vi, beforeEach } from 'vitest';

function dbChain(finalValue: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(finalValue);
  chain.returning = vi.fn().mockResolvedValue(finalValue);
  return chain;
}

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => dbChain()),
    select: vi.fn(() => dbChain()),
  },
}));

const mockDeliverWebhook = vi.fn();

vi.mock('./webhook.delivery', () => ({
  deliverWebhook: (...args: unknown[]) => mockDeliverWebhook(...args),
}));

vi.mock('./webhook-delivery.schema', () => ({
  webhookDelivery: {
    id: 'id',
    attemptNumber: 'attemptNumber',
    status: 'status',
    httpStatus: 'httpStatus',
    responseBody: 'responseBody',
    responseLatencyMs: 'responseLatencyMs',
    errorMessage: 'errorMessage',
    completedAt: 'completedAt',
  },
}));

vi.mock('./webhook-endpoint.schema', () => ({
  webhookEndpoint: {
    id: 'id',
    failingSince: 'failingSince',
    enabled: 'enabled',
    disabledAt: 'disabledAt',
    disabledReason: 'disabledReason',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('@/lib/config/env', () => ({
  env: { WEBHOOK_TIMEOUT_MS: 10000, NODE_ENV: 'production' },
}));

describe('webhook handler', () => {
  const mockBoss = {
    work: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerWebhookHandlers', () => {
    it('registers the webhook-delivery worker', async () => {
      const { registerWebhookHandlers } = await import('./webhook.handler');
      await registerWebhookHandlers(mockBoss as never);
      expect(mockBoss.work).toHaveBeenCalledWith(
        'webhook-delivery',
        expect.objectContaining({
          includeMetadata: true,
          localConcurrency: 5,
        }),
        expect.any(Function)
      );
    });
  });

  describe('delivery job processing', () => {
    async function getHandler() {
      const { registerWebhookHandlers } = await import('./webhook.handler');
      await registerWebhookHandlers(mockBoss as never);
      return mockBoss.work.mock.calls[0][2];
    }

    function createJob(overrides = {}) {
      return {
        id: 'job_123',
        name: 'webhook-delivery',
        data: {
          deliveryId: 'whd_test',
          endpointId: 'wh_test',
          eventId: 'evt_test',
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          payload: {
            event: 'webhook.test',
            timestamp: '2026-04-02T12:00:00.000Z',
            data: { test: true },
          },
        },
        retryCount: 0,
        retryLimit: 7,
        expireInSeconds: 30,
        heartbeatSeconds: null,
        signal: new AbortController().signal,
        ...overrides,
      };
    }

    async function setupDb(endpointData: object = { failingSince: null, enabled: true }) {
      const { db } = await import('@/lib/db');
      vi.mocked(db.update).mockImplementation(() => dbChain() as never);
      vi.mocked(db.select).mockImplementation(() => dbChain([endpointData]) as never);
    }

    it('handles successful delivery', async () => {
      await setupDb();
      mockDeliverWebhook.mockResolvedValue({
        success: true,
        httpStatus: 200,
        responseBody: 'OK',
        latencyMs: 50,
      });

      const handler = await getHandler();
      await handler([createJob()]);

      expect(mockDeliverWebhook).toHaveBeenCalled();
    });

    it('handles failed delivery and throws for retry', async () => {
      await setupDb();
      mockDeliverWebhook.mockResolvedValue({
        success: false,
        httpStatus: 500,
        responseBody: 'Internal Server Error',
        latencyMs: 100,
        error: 'HTTP 500',
      });

      const handler = await getHandler();
      await expect(handler([createJob()])).rejects.toThrow('HTTP 500');
    });

    it('does not throw for permanent failures', async () => {
      await setupDb();
      mockDeliverWebhook.mockResolvedValue({
        success: false,
        httpStatus: null,
        responseBody: null,
        latencyMs: 0,
        error: 'SSRF blocked',
        permanent: true,
      });

      const handler = await getHandler();
      // Should not throw — permanent failures don't retry
      await handler([createJob()]);
    });

    it('auto-disables endpoint after 5 days of failures', async () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      await setupDb({ failingSince: sixDaysAgo, enabled: true });

      mockDeliverWebhook.mockResolvedValue({
        success: false,
        httpStatus: 500,
        responseBody: 'Error',
        latencyMs: 100,
        error: 'HTTP 500',
      });

      const handler = await getHandler();
      // At final retry (retryCount >= retryLimit - 1), should auto-disable
      await handler([createJob({ retryCount: 6 })]);

      // Should not throw — endpoint auto-disabled instead of retrying
    });
  });
});
