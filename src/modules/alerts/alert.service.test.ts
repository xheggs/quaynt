// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a chainable mock that tracks calls in sequence
let selectResults: unknown[][] = [];
let selectCallIndex = 0;
let insertResults: unknown[][] = [];
let deleteResults: unknown[][] = [];
let updateResults: unknown[][] = [];

function createChain(results: () => unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.offset = vi.fn().mockImplementation(() => results());
  chain.orderBy = vi.fn().mockImplementation(self);
  chain.values = vi.fn().mockImplementation(self);
  chain.set = vi.fn().mockImplementation(self);
  chain.returning = vi.fn().mockImplementation(() => results());
  // For queries ending with .limit(1) directly (no offset), resolve via then
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve(results()));
  return chain;
}

vi.mock('@/lib/db', () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => {
        const idx = selectCallIndex++;
        return createChain(() => selectResults[idx] ?? []);
      }),
      insert: vi.fn().mockImplementation(() => {
        return createChain(() => insertResults.shift() ?? []);
      }),
      update: vi.fn().mockImplementation(() => {
        return createChain(() => updateResults.shift() ?? []);
      }),
      delete: vi.fn().mockImplementation(() => {
        return createChain(() => deleteResults.shift() ?? []);
      }),
    },
  };
});

vi.mock('./alert.schema', () => ({
  alertRule: {
    id: 'id',
    workspaceId: 'workspaceId',
    name: 'name',
    description: 'description',
    metric: 'metric',
    promptSetId: 'promptSetId',
    scope: 'scope',
    condition: 'condition',
    threshold: 'threshold',
    direction: 'direction',
    cooldownMinutes: 'cooldownMinutes',
    severity: 'severity',
    enabled: 'enabled',
    lastEvaluatedAt: 'lastEvaluatedAt',
    lastTriggeredAt: 'lastTriggeredAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  alertEvent: {},
}));

vi.mock('@/modules/brands/brand.schema', () => ({
  brand: { id: 'id', workspaceId: 'workspaceId', name: 'name' },
}));

vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: { id: 'id', workspaceId: 'workspaceId' },
}));

vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: vi.fn().mockReturnValue({ limit: 25, offset: 0 }),
  sortConfig: vi.fn().mockReturnValue(undefined),
  countTotal: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/config/env', () => ({
  env: { ALERT_MAX_RULES_PER_WORKSPACE: 25 },
}));

const sampleRule = {
  id: 'alert_test123',
  workspaceId: 'ws_test',
  name: 'Test alert',
  description: null,
  metric: 'recommendation_share',
  promptSetId: 'ps_test',
  scope: { brandId: 'brand_test' },
  condition: 'drops_below',
  threshold: '20.0000',
  direction: 'any',
  cooldownMinutes: 60,
  severity: 'warning',
  enabled: true,
  lastEvaluatedAt: null,
  lastTriggeredAt: null,
  createdAt: new Date('2026-04-02T12:00:00Z'),
  updatedAt: new Date('2026-04-02T12:00:00Z'),
};

describe('alert service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectCallIndex = 0;
    insertResults = [];
    deleteResults = [];
    updateResults = [];
  });

  describe('createAlertRule', () => {
    it('creates a rule with correct defaults', async () => {
      // select 0: brand exists
      selectResults[0] = [{ id: 'brand_test' }];
      // select 1: prompt set exists
      selectResults[1] = [{ id: 'ps_test' }];
      // select 2: count returns below limit
      selectResults[2] = [{ ruleCount: 0 }];
      // insert returns created rule
      insertResults.push([sampleRule]);

      const { createAlertRule } = await import('./alert.service');
      const result = await createAlertRule('ws_test', {
        name: 'Test alert',
        metric: 'recommendation_share',
        promptSetId: 'ps_test',
        scope: { brandId: 'brand_test' },
        condition: 'drops_below',
        threshold: 20,
      });

      expect(result).toEqual(sampleRule);
    });

    it('throws when brand not found', async () => {
      selectResults[0] = []; // brand not found

      const { createAlertRule } = await import('./alert.service');
      await expect(
        createAlertRule('ws_test', {
          name: 'Test',
          metric: 'recommendation_share',
          promptSetId: 'ps_test',
          scope: { brandId: 'brand_missing' },
          condition: 'drops_below',
          threshold: 20,
        })
      ).rejects.toThrow('Brand not found');
    });

    it('throws when prompt set not found', async () => {
      selectResults[0] = [{ id: 'brand_test' }]; // brand found
      selectResults[1] = []; // prompt set not found

      const { createAlertRule } = await import('./alert.service');
      await expect(
        createAlertRule('ws_test', {
          name: 'Test',
          metric: 'recommendation_share',
          promptSetId: 'ps_missing',
          scope: { brandId: 'brand_test' },
          condition: 'drops_below',
          threshold: 20,
        })
      ).rejects.toThrow('Prompt set not found');
    });

    it('throws when workspace rule limit reached', async () => {
      selectResults[0] = [{ id: 'brand_test' }];
      selectResults[1] = [{ id: 'ps_test' }];
      selectResults[2] = [{ ruleCount: 25 }];

      const { createAlertRule } = await import('./alert.service');
      await expect(
        createAlertRule('ws_test', {
          name: 'Test',
          metric: 'recommendation_share',
          promptSetId: 'ps_test',
          scope: { brandId: 'brand_test' },
          condition: 'drops_below',
          threshold: 20,
        })
      ).rejects.toThrow('limit reached');
    });
  });

  describe('listAlertRules', () => {
    it('returns paginated results', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      (countTotal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
      selectResults[0] = [sampleRule];

      const { listAlertRules } = await import('./alert.service');
      const result = await listAlertRules('ws_test', {
        page: 1,
        limit: 25,
        order: 'desc',
      });

      expect(result.items).toEqual([sampleRule]);
      expect(result.total).toBe(1);
    });
  });

  describe('getAlertRule', () => {
    it('returns rule by ID within workspace', async () => {
      selectResults[0] = [sampleRule];

      const { getAlertRule } = await import('./alert.service');
      const result = await getAlertRule('alert_test123', 'ws_test');
      expect(result).toEqual(sampleRule);
    });

    it('returns null for non-existent rule', async () => {
      selectResults[0] = [];

      const { getAlertRule } = await import('./alert.service');
      const result = await getAlertRule('alert_missing', 'ws_test');
      expect(result).toBeNull();
    });
  });

  describe('updateAlertRule', () => {
    it('updates fields and returns updated rule', async () => {
      const updated = { ...sampleRule, name: 'Updated name' };
      updateResults.push([updated]);

      const { updateAlertRule } = await import('./alert.service');
      const result = await updateAlertRule('alert_test123', 'ws_test', {
        name: 'Updated name',
      });

      expect(result).toEqual(updated);
    });

    it('throws when trying to change metric', async () => {
      const { updateAlertRule } = await import('./alert.service');
      await expect(
        updateAlertRule('alert_test123', 'ws_test', {
          metric: 'sentiment_score',
        } as unknown as Parameters<typeof updateAlertRule>[2])
      ).rejects.toThrow('Cannot change metric');
    });

    it('returns null for non-existent rule', async () => {
      updateResults.push([]);

      const { updateAlertRule } = await import('./alert.service');
      const result = await updateAlertRule('alert_missing', 'ws_test', {
        name: 'Test',
      });
      expect(result).toBeNull();
    });
  });

  describe('deleteAlertRule', () => {
    it('deletes rule and returns true', async () => {
      deleteResults.push([{ id: 'alert_test123' }]);

      const { deleteAlertRule } = await import('./alert.service');
      const result = await deleteAlertRule('alert_test123', 'ws_test');
      expect(result).toBe(true);
    });

    it('returns false for non-existent rule', async () => {
      deleteResults.push([]);

      const { deleteAlertRule } = await import('./alert.service');
      const result = await deleteAlertRule('alert_missing', 'ws_test');
      expect(result).toBe(false);
    });
  });
});
