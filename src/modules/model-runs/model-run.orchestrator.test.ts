// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockGroupBy = vi.fn();

vi.mock('@/lib/db', () => {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit, groupBy: mockGroupBy });
  mockLimit.mockReturnValue([]);
  mockGroupBy.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockReturning });

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

vi.mock('./model-run.schema', () => ({
  modelRun: {
    id: 'id',
    workspaceId: 'workspaceId',
    promptSetId: 'promptSetId',
    brandId: 'brandId',
    adapterConfigIds: 'adapterConfigIds',
    locale: 'locale',
    market: 'market',
    status: 'status',
    totalResults: 'totalResults',
    pendingResults: 'pendingResults',
    errorSummary: 'errorSummary',
    startedAt: 'startedAt',
    completedAt: 'completedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  modelRunResult: {
    id: 'id',
    modelRunId: 'modelRunId',
    promptId: 'promptId',
    adapterConfigId: 'adapterConfigId',
    platformId: 'platformId',
    interpolatedPrompt: 'interpolatedPrompt',
    status: 'status',
    rawResponse: 'rawResponse',
    textContent: 'textContent',
    responseMetadata: 'responseMetadata',
    error: 'error',
    startedAt: 'startedAt',
    completedAt: 'completedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@/lib/db/id', () => ({
  generatePrefixedId: vi.fn().mockReturnValue('runres_mock123'),
}));

const mockListPrompts = vi.fn();
vi.mock('@/modules/prompt-sets/prompt-set.service', () => ({
  listPrompts: (...args: unknown[]) => mockListPrompts(...args),
}));

const mockGetBrand = vi.fn();
vi.mock('@/modules/brands/brand.service', () => ({
  getBrand: (...args: unknown[]) => mockGetBrand(...args),
}));

vi.mock('@/modules/prompt-sets/template', () => ({
  interpolateTemplate: vi.fn((template: string, vars: Record<string, string>) => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key.toLowerCase()] ?? _);
  }),
}));

const mockCreateInstance = vi.fn();
const mockGetMetadata = vi.fn().mockReturnValue(undefined);
vi.mock('@/modules/adapters', () => ({
  getAdapterRegistry: vi.fn(() => ({
    createInstance: mockCreateInstance,
    getMetadata: mockGetMetadata,
  })),
}));

vi.mock('@/modules/adapters/adapter.schema', () => ({
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
    deletedAt: 'deletedAt',
  },
}));

vi.mock('@/modules/adapters/adapter.crypto', () => ({
  decryptCredential: vi.fn().mockReturnValue('{}'),
}));

const mockDispatchWebhookEvent = vi.fn().mockResolvedValue({});
vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...args: unknown[]) => mockDispatchWebhookEvent(...args),
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

const mockBoss = {
  insert: vi.fn().mockResolvedValue(['job_1', 'job_2']),
  send: vi.fn().mockResolvedValue('job_123'),
  schedule: vi.fn().mockResolvedValue(undefined),
};

function resetMockChains() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit, groupBy: mockGroupBy });
  mockLimit.mockReturnValue([]);
  mockGroupBy.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockReturning });
}

describe('model-run orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockChains();
  });

  describe('executeModelRun', () => {
    it('loads prompts, interpolates templates, and batch-inserts worker jobs', async () => {
      // Load run
      mockLimit.mockReturnValueOnce([
        {
          id: 'run_test1',
          status: 'pending',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          adapterConfigIds: ['adapter_1'],
          locale: 'en-US',
          market: null,
        },
      ]);

      // Set status to running (update returns)
      mockUpdateWhere.mockReturnValueOnce({ returning: mockReturning });

      // Load adapter config
      mockLimit.mockReturnValueOnce([
        {
          id: 'adapter_1',
          workspaceId: 'ws_test',
          platformId: 'chatgpt',
          displayName: 'ChatGPT',
          enabled: true,
          credentials: {},
          config: {},
          rateLimitPoints: 10,
          rateLimitDuration: 60,
          timeoutMs: 30000,
          maxRetries: 3,
          circuitBreakerThreshold: 5,
          circuitBreakerResetMs: 60000,
        },
      ]);

      mockListPrompts.mockResolvedValue([
        { id: 'prompt_1', template: 'What is {{brand}}?', order: 0 },
      ]);
      mockGetBrand.mockResolvedValue({ id: 'brand_test', name: 'Acme Corp' });

      const { executeModelRun } = await import('./model-run.orchestrator');
      await executeModelRun(
        'run_test1',
        'ws_test',
        mockBoss as unknown as import('pg-boss').PgBoss
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(mockBoss.insert).toHaveBeenCalledWith(
        'model-run-query',
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              runId: 'run_test1',
              interpolatedPrompt: 'What is Acme Corp?',
            }),
          }),
        ])
      );
    });

    it('skips if run is not pending (idempotency)', async () => {
      mockLimit.mockReturnValueOnce([
        {
          id: 'run_test1',
          status: 'running',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          adapterConfigIds: ['adapter_1'],
          locale: null,
          market: null,
        },
      ]);

      const { executeModelRun } = await import('./model-run.orchestrator');
      await executeModelRun(
        'run_test1',
        'ws_test',
        mockBoss as unknown as import('pg-boss').PgBoss
      );

      expect(mockBoss.insert).not.toHaveBeenCalled();
    });

    it('sets run to failed when prompts cannot be loaded', async () => {
      mockLimit.mockReturnValueOnce([
        {
          id: 'run_test1',
          status: 'pending',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          adapterConfigIds: ['adapter_1'],
          locale: null,
          market: null,
        },
      ]);

      mockListPrompts.mockResolvedValue(null);

      const { executeModelRun } = await import('./model-run.orchestrator');
      await executeModelRun(
        'run_test1',
        'ws_test',
        mockBoss as unknown as import('pg-boss').PgBoss
      );

      // Should update to failed
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });
  });

  describe('executeModelRunQuery', () => {
    it('calls adapter.query() and stores result', async () => {
      const mockAdapter = {
        query: vi.fn().mockResolvedValue({
          rawResponse: { answer: 'test' },
          textContent: 'test response',
          metadata: { latencyMs: 100 },
        }),
      };
      mockCreateInstance.mockReturnValue(mockAdapter);

      // Idempotency check: result is pending
      mockLimit.mockReturnValueOnce([{ status: 'pending' }]);
      // Cancellation check: run is running
      mockLimit.mockReturnValueOnce([{ status: 'running' }]);
      // Set result to running (update)
      // Load adapter config
      mockLimit.mockReturnValueOnce([
        {
          id: 'adapter_1',
          workspaceId: 'ws_test',
          platformId: 'chatgpt',
          displayName: 'ChatGPT',
          enabled: true,
          credentials: {},
          config: {},
          rateLimitPoints: 10,
          rateLimitDuration: 60,
          timeoutMs: 30000,
          maxRetries: 3,
          circuitBreakerThreshold: 5,
          circuitBreakerResetMs: 60000,
        },
      ]);
      // Store result (update)
      // Decrement counter
      mockReturning.mockReturnValueOnce([]); // result running update
      mockReturning.mockReturnValueOnce([]); // store result update
      mockReturning.mockReturnValueOnce([{ pendingResults: 3 }]); // decrement

      const { executeModelRunQuery } = await import('./model-run.orchestrator');
      await executeModelRunQuery(
        'runres_1',
        'run_test1',
        'ws_test',
        'prompt_1',
        'adapter_1',
        'What is Acme Corp?',
        'en-US'
      );

      expect(mockAdapter.query).toHaveBeenCalledWith(
        'What is Acme Corp?',
        expect.objectContaining({ locale: 'en-US', idempotencyKey: 'runres_1' })
      );
    });

    it('skips if result is already completed (idempotency)', async () => {
      mockLimit.mockReturnValueOnce([{ status: 'completed' }]);

      const { executeModelRunQuery } = await import('./model-run.orchestrator');
      await executeModelRunQuery(
        'runres_1',
        'run_test1',
        'ws_test',
        'prompt_1',
        'adapter_1',
        'test',
        null
      );

      expect(mockCreateInstance).not.toHaveBeenCalled();
    });

    it('skips and marks as skipped if parent run is cancelled', async () => {
      // Result is pending
      mockLimit.mockReturnValueOnce([{ status: 'pending' }]);
      // Parent run is cancelled
      mockLimit.mockReturnValueOnce([{ status: 'cancelled' }]);
      // Decrement counter
      mockReturning.mockReturnValueOnce([]); // skip update
      mockReturning.mockReturnValueOnce([{ pendingResults: 2 }]); // decrement

      const { executeModelRunQuery } = await import('./model-run.orchestrator');
      await executeModelRunQuery(
        'runres_1',
        'run_test1',
        'ws_test',
        'prompt_1',
        'adapter_1',
        'test',
        null
      );

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped' }));
      expect(mockCreateInstance).not.toHaveBeenCalled();
    });

    it('sets result to failed on PermanentAdapterError', async () => {
      const { PermanentAdapterError } = await import('@/modules/adapters/adapter.types');
      const mockAdapter = {
        query: vi.fn().mockRejectedValue(new PermanentAdapterError('API key invalid', 'chatgpt')),
      };
      mockCreateInstance.mockReturnValue(mockAdapter);

      // Result is pending
      mockLimit.mockReturnValueOnce([{ status: 'pending' }]);
      // Run is running
      mockLimit.mockReturnValueOnce([{ status: 'running' }]);
      // Load adapter config
      mockLimit.mockReturnValueOnce([
        {
          id: 'adapter_1',
          workspaceId: 'ws_test',
          platformId: 'chatgpt',
          displayName: 'ChatGPT',
          enabled: true,
          credentials: {},
          config: {},
          rateLimitPoints: 10,
          rateLimitDuration: 60,
          timeoutMs: 30000,
          maxRetries: 3,
          circuitBreakerThreshold: 5,
          circuitBreakerResetMs: 60000,
        },
      ]);
      // Updates: running, failed, decrement
      mockReturning.mockReturnValueOnce([]); // running
      mockReturning.mockReturnValueOnce([]); // failed
      mockReturning.mockReturnValueOnce([{ pendingResults: 1 }]); // decrement

      const { executeModelRunQuery } = await import('./model-run.orchestrator');
      await executeModelRunQuery(
        'runres_1',
        'run_test1',
        'ws_test',
        'prompt_1',
        'adapter_1',
        'test',
        null
      );

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error: 'API key invalid' })
      );
    });

    it('throws on TransientAdapterError to trigger pg-boss retry', async () => {
      const { TransientAdapterError } = await import('@/modules/adapters/adapter.types');
      const mockAdapter = {
        query: vi.fn().mockRejectedValue(new TransientAdapterError('timeout', 'chatgpt')),
      };
      mockCreateInstance.mockReturnValue(mockAdapter);

      // Result is pending
      mockLimit.mockReturnValueOnce([{ status: 'pending' }]);
      // Run is running
      mockLimit.mockReturnValueOnce([{ status: 'running' }]);
      // Load adapter config
      mockLimit.mockReturnValueOnce([
        {
          id: 'adapter_1',
          workspaceId: 'ws_test',
          platformId: 'chatgpt',
          displayName: 'ChatGPT',
          enabled: true,
          credentials: {},
          config: {},
          rateLimitPoints: 10,
          rateLimitDuration: 60,
          timeoutMs: 30000,
          maxRetries: 3,
          circuitBreakerThreshold: 5,
          circuitBreakerResetMs: 60000,
        },
      ]);
      // Running update
      mockReturning.mockReturnValueOnce([]);

      const { executeModelRunQuery } = await import('./model-run.orchestrator');
      await expect(
        executeModelRunQuery(
          'runres_1',
          'run_test1',
          'ws_test',
          'prompt_1',
          'adapter_1',
          'test',
          null
        )
      ).rejects.toThrow('timeout');
    });
  });

  describe('finalizeModelRun', () => {
    it('sets status to completed when all results completed', async () => {
      // Count results by status
      mockGroupBy.mockReturnValueOnce([{ status: 'completed', count: 10 }]);
      // Update run status
      // Load run for webhook
      mockLimit.mockReturnValueOnce([
        {
          id: 'run_test1',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          adapterConfigIds: ['adapter_1'],
          locale: 'en-US',
          totalResults: 10,
          startedAt: new Date('2026-04-02T12:29:15Z'),
          completedAt: new Date('2026-04-02T12:30:00Z'),
        },
      ]);

      const { finalizeModelRun } = await import('./model-run.orchestrator');
      await finalizeModelRun(
        'run_test1',
        'ws_test',
        mockBoss as unknown as import('pg-boss').PgBoss
      );

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', pendingResults: 0 })
      );
      expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
        'ws_test',
        'model_run.completed',
        expect.any(Object),
        mockBoss
      );
    });

    it('sets status to failed when all results failed', async () => {
      mockGroupBy.mockReturnValueOnce([{ status: 'failed', count: 10 }]);
      mockLimit.mockReturnValueOnce([
        {
          id: 'run_test1',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          adapterConfigIds: ['adapter_1'],
          locale: null,
          totalResults: 10,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ]);

      const { finalizeModelRun } = await import('./model-run.orchestrator');
      await finalizeModelRun(
        'run_test1',
        'ws_test',
        mockBoss as unknown as import('pg-boss').PgBoss
      );

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
      expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
        'ws_test',
        'model_run.failed',
        expect.any(Object),
        mockBoss
      );
    });

    it('sets status to partial when mixed results', async () => {
      mockGroupBy.mockReturnValueOnce([
        { status: 'completed', count: 7 },
        { status: 'failed', count: 3 },
      ]);
      mockLimit.mockReturnValueOnce([
        {
          id: 'run_test1',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          adapterConfigIds: ['adapter_1'],
          locale: null,
          totalResults: 10,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ]);

      const { finalizeModelRun } = await import('./model-run.orchestrator');
      await finalizeModelRun(
        'run_test1',
        'ws_test',
        mockBoss as unknown as import('pg-boss').PgBoss
      );

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' }));
      expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
        'ws_test',
        'model_run.partial',
        expect.any(Object),
        mockBoss
      );
    });

    it('includes error summary when failures exist', async () => {
      mockGroupBy.mockReturnValueOnce([
        { status: 'completed', count: 5 },
        { status: 'failed', count: 3 },
        { status: 'skipped', count: 2 },
      ]);
      mockLimit.mockReturnValueOnce([
        {
          id: 'run_test1',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          adapterConfigIds: ['adapter_1'],
          locale: null,
          totalResults: 10,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      ]);

      const { finalizeModelRun } = await import('./model-run.orchestrator');
      await finalizeModelRun(
        'run_test1',
        'ws_test',
        mockBoss as unknown as import('pg-boss').PgBoss
      );

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          errorSummary: '3 of 10 queries failed',
        })
      );
    });
  });
});
