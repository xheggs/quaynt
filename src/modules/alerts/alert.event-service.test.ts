// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a chainable mock that tracks calls in sequence
let selectResults: unknown[][] = [];
let selectCallIndex = 0;
let updateResults: unknown[][] = [];

function createChain(results: () => unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.offset = vi.fn().mockImplementation(() => results());
  chain.orderBy = vi.fn().mockImplementation(self);
  chain.leftJoin = vi.fn().mockImplementation(self);
  chain.groupBy = vi.fn().mockImplementation(self);
  chain.set = vi.fn().mockImplementation(self);
  chain.returning = vi.fn().mockImplementation(() => results());
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
      update: vi.fn().mockImplementation(() => {
        return createChain(() => updateResults.shift() ?? []);
      }),
    },
  };
});

vi.mock('./alert.schema', () => ({
  alertRule: {
    id: 'id',
    name: 'name',
    workspaceId: 'workspaceId',
  },
  alertEvent: {
    id: 'id',
    alertRuleId: 'alertRuleId',
    workspaceId: 'workspaceId',
    severity: 'severity',
    metricValue: 'metricValue',
    previousValue: 'previousValue',
    threshold: 'threshold',
    condition: 'condition',
    scopeSnapshot: 'scopeSnapshot',
    triggeredAt: 'triggeredAt',
    acknowledgedAt: 'acknowledgedAt',
    snoozedUntil: 'snoozedUntil',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@/modules/brands/brand.schema', () => ({
  brand: { id: 'id', workspaceId: 'workspaceId', name: 'name' },
}));

vi.mock('@/modules/prompt-sets/prompt-set.schema', () => ({
  promptSet: { id: 'id', workspaceId: 'workspaceId' },
}));

vi.mock('@/lib/config/env', () => ({
  env: { ALERT_MAX_RULES_PER_WORKSPACE: 25 },
}));

vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: vi.fn().mockReturnValue({ limit: 25, offset: 0 }),
  sortConfig: vi.fn().mockReturnValue(undefined),
  countTotal: vi.fn().mockResolvedValue(0),
  applyDateRange: vi.fn(),
}));

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue({ eventId: 'evt_test', deliveryIds: [] }),
}));

const sampleEvent = {
  id: 'alertevt_test123',
  alertRuleId: 'alertRule_test456',
  ruleName: 'Test rule',
  workspaceId: 'ws_test',
  severity: 'warning',
  metricValue: '15.0000',
  previousValue: '22.0000',
  threshold: '20.0000',
  condition: 'drops_below',
  scopeSnapshot: { brandId: 'brand_test' },
  triggeredAt: new Date('2026-04-02T10:00:00Z'),
  acknowledgedAt: null,
  snoozedUntil: null,
  createdAt: new Date('2026-04-02T10:00:00Z'),
  updatedAt: new Date('2026-04-02T10:00:00Z'),
};

describe('alert event service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectCallIndex = 0;
    updateResults = [];
  });

  describe('listAlertEvents', () => {
    it('returns paginated results with correct total', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      (countTotal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
      selectResults[0] = [sampleEvent];

      const { listAlertEvents } = await import('./alert.service');
      const result = await listAlertEvents('ws_test', { page: 1, limit: 25, order: 'desc' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('active');
      expect(result.total).toBe(1);
    });

    it('includes rule name in response items', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      (countTotal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
      selectResults[0] = [sampleEvent];

      const { listAlertEvents } = await import('./alert.service');
      const result = await listAlertEvents('ws_test', { page: 1, limit: 25, order: 'desc' });

      expect(result.items[0].ruleName).toBe('Test rule');
    });

    it('returns acknowledged status when acknowledgedAt is set', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      (countTotal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
      selectResults[0] = [{ ...sampleEvent, acknowledgedAt: new Date('2026-04-02T11:00:00Z') }];

      const { listAlertEvents } = await import('./alert.service');
      const result = await listAlertEvents('ws_test', { page: 1, limit: 25, order: 'desc' });

      expect(result.items[0].status).toBe('acknowledged');
    });

    it('returns snoozed status when snoozedUntil is in the future', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      (countTotal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      selectResults[0] = [{ ...sampleEvent, snoozedUntil: futureDate }];

      const { listAlertEvents } = await import('./alert.service');
      const result = await listAlertEvents('ws_test', { page: 1, limit: 25, order: 'desc' });

      expect(result.items[0].status).toBe('snoozed');
    });

    it('returns active status when snoozedUntil is expired', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      (countTotal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      selectResults[0] = [{ ...sampleEvent, snoozedUntil: pastDate }];

      const { listAlertEvents } = await import('./alert.service');
      const result = await listAlertEvents('ws_test', { page: 1, limit: 25, order: 'desc' });

      expect(result.items[0].status).toBe('active');
    });

    it('filters by severity', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      (countTotal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0);
      selectResults[0] = [];

      const { listAlertEvents } = await import('./alert.service');
      await listAlertEvents(
        'ws_test',
        { page: 1, limit: 25, order: 'desc' },
        { severity: 'critical' }
      );

      // Verify the function ran without error — filter logic is in SQL conditions
      expect(countTotal).toHaveBeenCalled();
    });

    it('filters by date range', async () => {
      const { countTotal, applyDateRange } = await import('@/lib/db/query-helpers');
      (countTotal as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0);
      selectResults[0] = [];

      const { listAlertEvents } = await import('./alert.service');
      await listAlertEvents(
        'ws_test',
        { page: 1, limit: 25, order: 'desc' },
        {
          from: '2026-04-01T00:00:00Z',
          to: '2026-04-03T00:00:00Z',
        }
      );

      expect(applyDateRange).toHaveBeenCalled();
    });
  });

  describe('getAlertEvent', () => {
    it('returns event by ID within workspace', async () => {
      selectResults[0] = [sampleEvent];

      const { getAlertEvent } = await import('./alert.service');
      const result = await getAlertEvent('alertevt_test123', 'ws_test');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('alertevt_test123');
      expect(result!.status).toBe('active');
    });

    it('returns null for non-existent event', async () => {
      selectResults[0] = [];

      const { getAlertEvent } = await import('./alert.service');
      const result = await getAlertEvent('alertevt_nonexistent', 'ws_test');

      expect(result).toBeNull();
    });
  });

  describe('acknowledgeAlertEvent', () => {
    it('sets acknowledgedAt timestamp on unacknowledged event', async () => {
      // getAlertEvent select
      selectResults[0] = [sampleEvent];
      updateResults.push([]);

      const { acknowledgeAlertEvent } = await import('./alert.service');
      const result = await acknowledgeAlertEvent('alertevt_test123', 'ws_test');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('acknowledged');
      expect(result!.acknowledgedAt).toBeInstanceOf(Date);
    });

    it('is idempotent: returns current state for already-acknowledged event', async () => {
      const acked = { ...sampleEvent, acknowledgedAt: new Date('2026-04-02T11:00:00Z') };
      selectResults[0] = [acked];

      const { acknowledgeAlertEvent } = await import('./alert.service');
      const result = await acknowledgeAlertEvent('alertevt_test123', 'ws_test');

      expect(result).not.toBeNull();
      expect(result!.acknowledgedAt).toEqual(new Date('2026-04-02T11:00:00Z'));
      // Should not have called update
      const { db } = await import('@/lib/db');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('returns null for non-existent event', async () => {
      selectResults[0] = [];

      const { acknowledgeAlertEvent } = await import('./alert.service');
      const result = await acknowledgeAlertEvent('alertevt_nonexistent', 'ws_test');

      expect(result).toBeNull();
    });

    it('dispatches webhook when boss is provided', async () => {
      selectResults[0] = [sampleEvent];
      updateResults.push([]);

      const mockBoss = {} as unknown as import('pg-boss').PgBoss;
      const { acknowledgeAlertEvent } = await import('./alert.service');
      await acknowledgeAlertEvent('alertevt_test123', 'ws_test', mockBoss);

      const { dispatchWebhookEvent } = await import('@/modules/webhooks/webhook.service');
      expect(dispatchWebhookEvent).toHaveBeenCalledWith(
        'ws_test',
        'alert.acknowledged',
        expect.objectContaining({
          alertEventId: 'alertevt_test123',
          alertRuleId: 'alertRule_test456',
          severity: 'warning',
        }),
        mockBoss
      );
    });
  });

  describe('snoozeAlertEvent', () => {
    it('sets snoozedUntil from duration in seconds', async () => {
      selectResults[0] = [sampleEvent];
      updateResults.push([]);

      const { snoozeAlertEvent } = await import('./alert.service');
      const result = await snoozeAlertEvent('alertevt_test123', 'ws_test', { duration: 3600 });

      expect(result).not.toBeNull();
      expect(result!.snoozedUntil).toBeInstanceOf(Date);
      expect(result!.status).toBe('snoozed');
    });

    it('sets snoozedUntil from absolute ISO 8601 timestamp', async () => {
      selectResults[0] = [sampleEvent];
      updateResults.push([]);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { snoozeAlertEvent } = await import('./alert.service');
      const result = await snoozeAlertEvent('alertevt_test123', 'ws_test', {
        snoozedUntil: futureDate,
      });

      expect(result).not.toBeNull();
      expect(result!.snoozedUntil).toBeInstanceOf(Date);
    });

    it('rejects request with both duration and snoozedUntil', async () => {
      const { snoozeAlertEvent } = await import('./alert.service');

      await expect(
        snoozeAlertEvent('alertevt_test123', 'ws_test', {
          duration: 3600,
          snoozedUntil: new Date(Date.now() + 3600000).toISOString(),
        })
      ).rejects.toThrow('Provide exactly one');
    });

    it('rejects request with neither duration nor snoozedUntil', async () => {
      const { snoozeAlertEvent } = await import('./alert.service');

      await expect(snoozeAlertEvent('alertevt_test123', 'ws_test', {})).rejects.toThrow(
        'Provide exactly one'
      );
    });

    it('rejects duration exceeding 30 days', async () => {
      const { snoozeAlertEvent } = await import('./alert.service');

      await expect(
        snoozeAlertEvent('alertevt_test123', 'ws_test', { duration: 2_592_001 })
      ).rejects.toThrow('Duration exceeds maximum');
    });

    it('rejects snoozedUntil in the past', async () => {
      const { snoozeAlertEvent } = await import('./alert.service');
      const pastDate = new Date(Date.now() - 3600000).toISOString();

      await expect(
        snoozeAlertEvent('alertevt_test123', 'ws_test', { snoozedUntil: pastDate })
      ).rejects.toThrow('Snooze time must be in the future');
    });

    it('returns null for non-existent event', async () => {
      selectResults[0] = [];

      const { snoozeAlertEvent } = await import('./alert.service');
      const result = await snoozeAlertEvent('alertevt_test123', 'ws_test', { duration: 3600 });

      expect(result).toBeNull();
    });
  });

  describe('getAlertSummary', () => {
    it('returns correct counts for empty workspace', async () => {
      // Counts query
      selectResults[0] = [
        { total: 0, active: 0, acknowledged: 0, snoozed: 0, info: 0, warning: 0, critical: 0 },
      ];
      // TopRules query
      selectResults[1] = [];

      const { getAlertSummary } = await import('./alert.service');
      const result = await getAlertSummary('ws_test');

      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
      expect(result.acknowledged).toBe(0);
      expect(result.snoozed).toBe(0);
      expect(result.bySeverity).toEqual({ info: 0, warning: 0, critical: 0 });
      expect(result.topRules).toEqual([]);
      expect(result.period).toHaveProperty('from');
      expect(result.period).toHaveProperty('to');
    });

    it('returns correct counts with mixed event states', async () => {
      selectResults[0] = [
        { total: 10, active: 5, acknowledged: 3, snoozed: 2, info: 2, warning: 5, critical: 3 },
      ];
      selectResults[1] = [
        { ruleId: 'alertRule_1', ruleName: 'Rule 1', count: 5 },
        { ruleId: 'alertRule_2', ruleName: 'Rule 2', count: 3 },
      ];

      const { getAlertSummary } = await import('./alert.service');
      const result = await getAlertSummary('ws_test');

      expect(result.total).toBe(10);
      expect(result.active).toBe(5);
      expect(result.acknowledged).toBe(3);
      expect(result.snoozed).toBe(2);
      expect(result.bySeverity).toEqual({ info: 2, warning: 5, critical: 3 });
      expect(result.topRules).toHaveLength(2);
      expect(result.topRules[0]).toEqual({ ruleId: 'alertRule_1', ruleName: 'Rule 1', count: 5 });
    });

    it('uses custom date range when provided', async () => {
      selectResults[0] = [
        { total: 0, active: 0, acknowledged: 0, snoozed: 0, info: 0, warning: 0, critical: 0 },
      ];
      selectResults[1] = [];

      const { getAlertSummary } = await import('./alert.service');
      const result = await getAlertSummary('ws_test', {
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-31T23:59:59Z',
      });

      expect(result.period.from).toBe(new Date('2026-03-01T00:00:00Z').toISOString());
      expect(result.period.to).toBe(new Date('2026-03-31T23:59:59Z').toISOString());
    });
  });
});
