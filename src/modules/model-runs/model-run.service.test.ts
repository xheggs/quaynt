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
const mockGroupBy = vi.fn();

vi.mock('@/lib/db', () => {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({
    limit: mockLimit,
    orderBy: mockOrderBy,
    groupBy: mockGroupBy,
  });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue([]);
  mockOrderBy.mockReturnValue({ limit: mockLimit });
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

vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: vi.fn().mockReturnValue({ limit: 25, offset: 0 }),
  sortConfig: vi.fn().mockReturnValue(undefined),
  countTotal: vi.fn().mockResolvedValue(0),
  applyDateRange: vi.fn(),
}));

const mockGetPromptSet = vi.fn();
const mockListPrompts = vi.fn();
vi.mock('@/modules/prompt-sets/prompt-set.service', () => ({
  getPromptSet: (...args: unknown[]) => mockGetPromptSet(...args),
  listPrompts: (...args: unknown[]) => mockListPrompts(...args),
}));

const mockGetBrand = vi.fn();
vi.mock('@/modules/brands/brand.service', () => ({
  getBrand: (...args: unknown[]) => mockGetBrand(...args),
}));

const mockGetAdapterConfig = vi.fn();
vi.mock('@/modules/adapters/adapter.service', () => ({
  getAdapterConfig: (...args: unknown[]) => mockGetAdapterConfig(...args),
}));

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue({ eventId: 'evt_test', deliveryIds: [] }),
}));

const mockBoss = {
  send: vi.fn().mockResolvedValue('job_123'),
};

const sampleRun = {
  id: 'run_test123',
  workspaceId: 'ws_test',
  promptSetId: 'ps_test',
  brandId: 'brand_test',
  adapterConfigIds: ['adapter_1', 'adapter_2'],
  locale: 'en-US',
  market: null,
  status: 'pending',
  totalResults: 4,
  pendingResults: 4,
  errorSummary: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date('2026-04-02T12:00:00Z'),
  updatedAt: new Date('2026-04-02T12:00:00Z'),
};

function resetMockChains() {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({
    limit: mockLimit,
    orderBy: mockOrderBy,
    groupBy: mockGroupBy,
  });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue([]);
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockGroupBy.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockReturning });
}

describe('model-run service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockChains();
  });

  describe('createModelRun', () => {
    it('creates a model run and dispatches coordinator job', async () => {
      mockGetPromptSet.mockResolvedValue({ id: 'ps_test', name: 'Test Set' });
      mockGetBrand.mockResolvedValue({ id: 'brand_test', name: 'Test Brand' });
      mockGetAdapterConfig
        .mockResolvedValueOnce({ id: 'adapter_1', enabled: true, platformId: 'chatgpt' })
        .mockResolvedValueOnce({ id: 'adapter_2', enabled: true, platformId: 'perplexity' });
      mockListPrompts.mockResolvedValue([
        { id: 'prompt_1', template: 'Test {{brand}}', order: 0 },
        { id: 'prompt_2', template: 'Test 2 {{brand}}', order: 1 },
      ]);
      mockReturning.mockReturnValueOnce([sampleRun]);

      const { createModelRun } = await import('./model-run.service');
      const result = await createModelRun(
        'ws_test',
        {
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          adapterConfigIds: ['adapter_1', 'adapter_2'],
          locale: 'en-US',
        },
        mockBoss as unknown as import('pg-boss').PgBoss
      );

      expect(result).toEqual(sampleRun);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockBoss.send).toHaveBeenCalledWith(
        'model-run-execute',
        expect.objectContaining({ runId: 'run_test123', workspaceId: 'ws_test' }),
        expect.objectContaining({ retryLimit: 3, singletonKey: 'run_test123' })
      );
    });

    it('throws when prompt set not found', async () => {
      mockGetPromptSet.mockResolvedValue(null);

      const { createModelRun } = await import('./model-run.service');
      await expect(
        createModelRun(
          'ws_test',
          { promptSetId: 'ps_bad', brandId: 'brand_test', adapterConfigIds: ['adapter_1'] },
          mockBoss as unknown as import('pg-boss').PgBoss
        )
      ).rejects.toThrow('Prompt set not found');
    });

    it('throws when brand not found', async () => {
      mockGetPromptSet.mockResolvedValue({ id: 'ps_test', name: 'Test Set' });
      mockGetBrand.mockResolvedValue(null);

      const { createModelRun } = await import('./model-run.service');
      await expect(
        createModelRun(
          'ws_test',
          { promptSetId: 'ps_test', brandId: 'brand_bad', adapterConfigIds: ['adapter_1'] },
          mockBoss as unknown as import('pg-boss').PgBoss
        )
      ).rejects.toThrow('Brand not found');
    });

    it('throws when adapter config not found', async () => {
      mockGetPromptSet.mockResolvedValue({ id: 'ps_test', name: 'Test Set' });
      mockGetBrand.mockResolvedValue({ id: 'brand_test', name: 'Test Brand' });
      mockGetAdapterConfig.mockResolvedValue(null);

      const { createModelRun } = await import('./model-run.service');
      await expect(
        createModelRun(
          'ws_test',
          { promptSetId: 'ps_test', brandId: 'brand_test', adapterConfigIds: ['adapter_bad'] },
          mockBoss as unknown as import('pg-boss').PgBoss
        )
      ).rejects.toThrow('Adapter configuration not found: adapter_bad');
    });

    it('throws when adapter config is disabled', async () => {
      mockGetPromptSet.mockResolvedValue({ id: 'ps_test', name: 'Test Set' });
      mockGetBrand.mockResolvedValue({ id: 'brand_test', name: 'Test Brand' });
      mockGetAdapterConfig.mockResolvedValue({
        id: 'adapter_1',
        enabled: false,
        platformId: 'chatgpt',
      });

      const { createModelRun } = await import('./model-run.service');
      await expect(
        createModelRun(
          'ws_test',
          { promptSetId: 'ps_test', brandId: 'brand_test', adapterConfigIds: ['adapter_1'] },
          mockBoss as unknown as import('pg-boss').PgBoss
        )
      ).rejects.toThrow('Adapter configuration is disabled: adapter_1');
    });

    it('throws when prompt set has no prompts', async () => {
      mockGetPromptSet.mockResolvedValue({ id: 'ps_test', name: 'Test Set' });
      mockGetBrand.mockResolvedValue({ id: 'brand_test', name: 'Test Brand' });
      mockGetAdapterConfig.mockResolvedValue({
        id: 'adapter_1',
        enabled: true,
        platformId: 'chatgpt',
      });
      mockListPrompts.mockResolvedValue([]);

      const { createModelRun } = await import('./model-run.service');
      await expect(
        createModelRun(
          'ws_test',
          { promptSetId: 'ps_test', brandId: 'brand_test', adapterConfigIds: ['adapter_1'] },
          mockBoss as unknown as import('pg-boss').PgBoss
        )
      ).rejects.toThrow('Prompt set has no prompts');
    });
  });

  describe('getModelRun', () => {
    it('returns run with result summary', async () => {
      // First call: fetch run
      mockLimit.mockReturnValueOnce([sampleRun]);
      // Second call: result summary groupBy
      mockGroupBy.mockReturnValueOnce([
        { status: 'completed', count: 3 },
        { status: 'failed', count: 1 },
      ]);

      const { getModelRun } = await import('./model-run.service');
      const result = await getModelRun('run_test123', 'ws_test');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('run_test123');
      expect(result!.resultSummary.completed).toBe(3);
      expect(result!.resultSummary.failed).toBe(1);
      expect(result!.resultSummary.total).toBe(4);
    });

    it('returns null for non-existent run', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { getModelRun } = await import('./model-run.service');
      const result = await getModelRun('run_nonexistent', 'ws_test');

      expect(result).toBeNull();
    });
  });

  describe('listModelRuns', () => {
    it('returns paginated results', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(2);
      mockOffset.mockReturnValueOnce([sampleRun, { ...sampleRun, id: 'run_test456' }]);

      const { listModelRuns } = await import('./model-run.service');
      const result = await listModelRuns('ws_test', {
        page: 1,
        limit: 25,
        order: 'desc',
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('applies status filter', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(1);
      mockOffset.mockReturnValueOnce([sampleRun]);

      const { listModelRuns } = await import('./model-run.service');
      const result = await listModelRuns(
        'ws_test',
        { page: 1, limit: 25, order: 'desc' },
        { status: 'pending' }
      );

      expect(result.items).toHaveLength(1);
    });

    it('applies date range filter', async () => {
      const { countTotal, applyDateRange } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(1);
      mockOffset.mockReturnValueOnce([sampleRun]);

      const { listModelRuns } = await import('./model-run.service');
      await listModelRuns(
        'ws_test',
        { page: 1, limit: 25, order: 'desc' },
        { from: '2026-04-01T00:00:00Z', to: '2026-04-03T00:00:00Z' }
      );

      expect(applyDateRange).toHaveBeenCalled();
    });
  });

  describe('cancelModelRun', () => {
    it('cancels a pending run', async () => {
      const cancelledRun = { ...sampleRun, status: 'cancelled', completedAt: new Date() };

      // First call: load current run
      mockLimit.mockReturnValueOnce([{ id: 'run_test123', status: 'pending', pendingResults: 4 }]);
      // Update pending results to skipped — returns skipped result IDs
      mockReturning.mockReturnValueOnce([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }]);
      // Update run status — returns updated run
      mockReturning.mockReturnValueOnce([cancelledRun]);

      const { cancelModelRun } = await import('./model-run.service');
      const result = await cancelModelRun('run_test123', 'ws_test');

      expect(result).toEqual(cancelledRun);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns null for non-existent run', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { cancelModelRun } = await import('./model-run.service');
      const result = await cancelModelRun('run_nonexistent', 'ws_test');

      expect(result).toBeNull();
    });

    it('throws when run is already in terminal state', async () => {
      mockLimit.mockReturnValueOnce([
        { id: 'run_test123', status: 'completed', pendingResults: 0 },
      ]);

      const { cancelModelRun } = await import('./model-run.service');
      await expect(cancelModelRun('run_test123', 'ws_test')).rejects.toThrow(
        'Model run is already completed'
      );
    });

    it('throws when run is already failed', async () => {
      mockLimit.mockReturnValueOnce([{ id: 'run_test123', status: 'failed', pendingResults: 0 }]);

      const { cancelModelRun } = await import('./model-run.service');
      await expect(cancelModelRun('run_test123', 'ws_test')).rejects.toThrow(
        'Model run is already failed'
      );
    });
  });
});
