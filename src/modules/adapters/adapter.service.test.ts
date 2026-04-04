// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: (...args: unknown[]) => mockSelect(...args),
      insert: (...args: unknown[]) => mockInsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  };
});

vi.mock('./adapter.schema', () => ({
  platformAdapter: {
    id: 'id',
    workspaceId: 'workspaceId',
    platformId: 'platformId',
    displayName: 'displayName',
    enabled: 'enabled',
    credentials: 'credentials',
    config: 'config',
    rateLimitPoints: 'rateLimitPoints',
    rateLimitDuration: 'rateLimitDuration',
    timeoutMs: 'timeoutMs',
    maxRetries: 'maxRetries',
    circuitBreakerThreshold: 'circuitBreakerThreshold',
    circuitBreakerResetMs: 'circuitBreakerResetMs',
    lastHealthStatus: 'lastHealthStatus',
    lastHealthCheckedAt: 'lastHealthCheckedAt',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: vi.fn().mockReturnValue({ limit: 25, offset: 0 }),
  sortConfig: vi.fn().mockReturnValue(undefined),
  countTotal: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue({ eventId: 'evt_test', deliveryIds: [] }),
}));

vi.mock('./adapter.crypto', () => ({
  encryptCredential: vi.fn().mockReturnValue({
    ciphertext: 'abc123',
    iv: 'def456',
    tag: 'ghi789',
    keyVersion: 1,
  }),
  decryptCredential: vi.fn().mockReturnValue('{"apiKey":"sk-test"}'),
}));

const mockRegistry = {
  isRegistered: vi.fn().mockReturnValue(true),
  getMetadata: vi.fn().mockReturnValue({
    platformId: 'chatgpt',
    displayName: 'ChatGPT',
    version: '1.0.0',
    apiVersion: 'v1',
    capabilities: ['query'],
    credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
    healthCheckStrategy: 'api_ping',
  }),
  createInstance: vi.fn(),
};

const sampleAdapterRecord = {
  id: 'adapter_test123',
  workspaceId: 'ws_test',
  platformId: 'chatgpt',
  displayName: 'Our ChatGPT',
  enabled: true,
  credentials: { ciphertext: 'abc', iv: 'def', tag: 'ghi', keyVersion: 1 },
  config: {},
  rateLimitPoints: 60,
  rateLimitDuration: 60,
  timeoutMs: 30000,
  maxRetries: 3,
  circuitBreakerThreshold: 50,
  circuitBreakerResetMs: 60000,
  lastHealthStatus: null,
  lastHealthCheckedAt: null,
  createdAt: new Date('2026-04-02T12:00:00Z'),
  updatedAt: new Date('2026-04-02T12:00:00Z'),
};

function resetMockChains() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy });
  mockLimit.mockReturnValue([]);
  mockOffset.mockReturnValue([]);
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockReturning });
}

describe('adapter service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks fully to clear stale mockReturnValueOnce queues
    [
      mockSelect,
      mockFrom,
      mockWhere,
      mockLimit,
      mockOffset,
      mockOrderBy,
      mockInsert,
      mockValues,
      mockReturning,
      mockUpdate,
      mockSet,
      mockUpdateWhere,
    ].forEach((m) => m.mockReset());
    resetMockChains();

    mockRegistry.isRegistered.mockReturnValue(true);
    mockRegistry.getMetadata.mockReturnValue({
      platformId: 'chatgpt',
      displayName: 'ChatGPT',
      version: '1.0.0',
      apiVersion: 'v1',
      capabilities: ['query'],
      credentialSchema: [{ field: 'apiKey', type: 'string', required: true, sensitive: true }],
      healthCheckStrategy: 'api_ping',
    });
  });

  describe('createAdapterConfig', () => {
    it('creates adapter config with encrypted credentials', async () => {
      // Uniqueness check returns empty
      mockLimit.mockReturnValueOnce([]);
      // Insert returning
      mockReturning.mockReturnValueOnce([sampleAdapterRecord]);

      const { createAdapterConfig } = await import('./adapter.service');
      const result = await createAdapterConfig(
        'ws_test',
        {
          platformId: 'chatgpt',
          displayName: 'Our ChatGPT',
          credentials: { apiKey: 'sk-test' },
        },
        mockRegistry as unknown as import('./adapter.registry').AdapterRegistry
      );

      expect(result.id).toBe('adapter_test123');
      expect(result.credentialsSet).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('throws when platform is not registered', async () => {
      mockRegistry.isRegistered.mockReturnValue(false);

      const { createAdapterConfig } = await import('./adapter.service');
      await expect(
        createAdapterConfig(
          'ws_test',
          { platformId: 'unknown', displayName: 'Test' },
          mockRegistry as unknown as import('./adapter.registry').AdapterRegistry
        )
      ).rejects.toThrow('Unknown platform: unknown');
    });

    it('throws on duplicate adapter for same platform in workspace', async () => {
      mockLimit.mockReturnValueOnce([{ id: 'adapter_existing' }]);

      const { createAdapterConfig } = await import('./adapter.service');
      await expect(
        createAdapterConfig(
          'ws_test',
          {
            platformId: 'chatgpt',
            displayName: 'Another ChatGPT',
            credentials: { apiKey: 'sk-test' },
          },
          mockRegistry as unknown as import('./adapter.registry').AdapterRegistry
        )
      ).rejects.toThrow('already exists');
    });

    it('validates credentials against platform schema', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { createAdapterConfig } = await import('./adapter.service');
      await expect(
        createAdapterConfig(
          'ws_test',
          {
            platformId: 'chatgpt',
            displayName: 'Test',
            credentials: { apiKey: 123 }, // wrong type
          },
          mockRegistry as unknown as import('./adapter.registry').AdapterRegistry
        )
      ).rejects.toThrow('must be of type string');
    });
  });

  describe('listAdapterConfigs', () => {
    it('returns paginated results with credentialsSet flag', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(1);

      // list chain: select → from → where → orderBy → limit → offset
      const mockListOffset = vi.fn().mockReturnValue([sampleAdapterRecord]);
      const mockListLimit = vi.fn().mockReturnValue({ offset: mockListOffset });
      mockOrderBy.mockReturnValueOnce({ limit: mockListLimit });

      const { listAdapterConfigs } = await import('./adapter.service');
      const result = await listAdapterConfigs('ws_test', {
        page: 1,
        limit: 25,
        order: 'desc',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].credentialsSet).toBe(true);
      expect(result.total).toBe(1);
    });
  });

  describe('getAdapterConfig', () => {
    it('returns adapter config with credentialsSet', async () => {
      mockLimit.mockReturnValueOnce([sampleAdapterRecord]);

      const { getAdapterConfig } = await import('./adapter.service');
      const result = await getAdapterConfig('adapter_test123', 'ws_test');

      expect(result).not.toBeNull();
      expect(result!.credentialsSet).toBe(true);
      expect(result!.id).toBe('adapter_test123');
    });

    it('returns null for non-existent adapter', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { getAdapterConfig } = await import('./adapter.service');
      const result = await getAdapterConfig('adapter_nonexistent', 'ws_test');

      expect(result).toBeNull();
    });
  });

  describe('updateAdapterConfig', () => {
    it('updates display name', async () => {
      const updated = { ...sampleAdapterRecord, displayName: 'Renamed' };
      mockReturning.mockReturnValueOnce([updated]);

      const { updateAdapterConfig } = await import('./adapter.service');
      const result = await updateAdapterConfig('adapter_test123', 'ws_test', {
        displayName: 'Renamed',
      });

      expect(result).not.toBeNull();
      expect(result!.displayName).toBe('Renamed');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('re-encrypts credentials when changed', async () => {
      // For credential validation, need to return platformId
      mockLimit.mockReturnValueOnce([{ platformId: 'chatgpt' }]);
      mockReturning.mockReturnValueOnce([sampleAdapterRecord]);

      const { updateAdapterConfig } = await import('./adapter.service');
      const { encryptCredential } = await import('./adapter.crypto');

      await updateAdapterConfig(
        'adapter_test123',
        'ws_test',
        { credentials: { apiKey: 'sk-new' } },
        mockRegistry as unknown as import('./adapter.registry').AdapterRegistry
      );

      expect(encryptCredential).toHaveBeenCalled();
    });

    it('returns null for non-existent adapter', async () => {
      mockReturning.mockReturnValueOnce([]);

      const { updateAdapterConfig } = await import('./adapter.service');
      const result = await updateAdapterConfig('adapter_nonexistent', 'ws_test', {
        displayName: 'Test',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteAdapterConfig', () => {
    it('soft deletes adapter', async () => {
      mockReturning.mockReturnValueOnce([
        {
          id: 'adapter_test123',
          platformId: 'chatgpt',
          displayName: 'Our ChatGPT',
        },
      ]);

      const { deleteAdapterConfig } = await import('./adapter.service');
      const result = await deleteAdapterConfig('adapter_test123', 'ws_test');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns false for non-existent adapter', async () => {
      mockReturning.mockReturnValueOnce([]);

      const { deleteAdapterConfig } = await import('./adapter.service');
      const result = await deleteAdapterConfig('adapter_nonexistent', 'ws_test');

      expect(result).toBe(false);
    });
  });

  describe('getAdapterHealth', () => {
    it('runs health check and returns status', async () => {
      const healthResult = {
        status: 'healthy' as const,
        latencyMs: 50,
        lastCheckedAt: new Date(),
      };

      const mockAdapter = {
        healthCheck: vi.fn().mockResolvedValue(healthResult),
      };
      mockRegistry.createInstance.mockReturnValue(mockAdapter);

      // Full record for health check
      mockLimit.mockReturnValueOnce([
        {
          ...sampleAdapterRecord,
          config: {},
        },
      ]);

      const { getAdapterHealth } = await import('./adapter.service');
      const result = await getAdapterHealth(
        'adapter_test123',
        'ws_test',
        mockRegistry as unknown as import('./adapter.registry').AdapterRegistry
      );

      expect(result).not.toBeNull();
      expect(result!.status).toBe('healthy');
      expect(mockAdapter.healthCheck).toHaveBeenCalled();
    });

    it('returns null for non-existent adapter', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { getAdapterHealth } = await import('./adapter.service');
      const result = await getAdapterHealth(
        'adapter_nonexistent',
        'ws_test',
        mockRegistry as unknown as import('./adapter.registry').AdapterRegistry
      );

      expect(result).toBeNull();
    });

    it('fires webhook when health status transitions', async () => {
      const mockBoss = {} as unknown as import('pg-boss').PgBoss;
      const healthResult = {
        status: 'unhealthy' as const,
        latencyMs: 5000,
        message: 'Connection refused',
        lastCheckedAt: new Date(),
      };

      const mockAdapter = {
        healthCheck: vi.fn().mockResolvedValue(healthResult),
      };
      mockRegistry.createInstance.mockReturnValue(mockAdapter);

      // Record with previous healthy status
      mockLimit.mockReturnValueOnce([
        {
          ...sampleAdapterRecord,
          lastHealthStatus: 'healthy',
          config: {},
        },
      ]);

      const { getAdapterHealth } = await import('./adapter.service');
      await getAdapterHealth(
        'adapter_test123',
        'ws_test',
        mockRegistry as unknown as import('./adapter.registry').AdapterRegistry,
        mockBoss
      );

      const { dispatchWebhookEvent } = await import('@/modules/webhooks/webhook.service');
      expect(dispatchWebhookEvent).toHaveBeenCalledWith(
        'ws_test',
        'adapter.health_changed',
        expect.objectContaining({
          previousStatus: 'healthy',
          currentStatus: 'unhealthy',
        }),
        mockBoss
      );
    });

    it('does not fire webhook when status unchanged', async () => {
      const healthResult = {
        status: 'healthy' as const,
        latencyMs: 50,
        lastCheckedAt: new Date(),
      };

      const mockAdapter = {
        healthCheck: vi.fn().mockResolvedValue(healthResult),
      };
      mockRegistry.createInstance.mockReturnValue(mockAdapter);

      mockLimit.mockReturnValueOnce([
        {
          ...sampleAdapterRecord,
          lastHealthStatus: 'healthy',
          config: {},
        },
      ]);

      const mockBoss = {} as unknown as import('pg-boss').PgBoss;
      const { getAdapterHealth } = await import('./adapter.service');
      await getAdapterHealth(
        'adapter_test123',
        'ws_test',
        mockRegistry as unknown as import('./adapter.registry').AdapterRegistry,
        mockBoss
      );

      const { dispatchWebhookEvent } = await import('@/modules/webhooks/webhook.service');
      expect(dispatchWebhookEvent).not.toHaveBeenCalled();
    });
  });
});
