// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgBoss } from 'pg-boss';

const mockComputeOpportunities = vi.fn();
const mockDispatchWebhookEvent = vi.fn();
const mockBossWork = vi.fn();
const mockBossSend = vi.fn();
const mockBossSchedule = vi.fn();
const mockSelectDistinct = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();

vi.mock('./opportunity.compute', () => ({
  computeOpportunities: (...args: unknown[]) => mockComputeOpportunities(...args),
}));

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...args: unknown[]) => mockDispatchWebhookEvent(...args),
}));

vi.mock('@/lib/db', () => {
  return {
    db: {
      selectDistinct: (...a: unknown[]) => mockSelectDistinct(...a),
    },
  };
});

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    workspaceId: 'workspaceId',
    modelRunId: 'modelRunId',
    createdAt: 'createdAt',
  },
}));

vi.mock('@/modules/model-runs/model-run.schema', () => ({
  modelRun: {
    id: 'id',
    promptSetId: 'promptSetId',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

function createMockBoss() {
  return {
    work: mockBossWork,
    send: mockBossSend,
    schedule: mockBossSchedule,
  };
}

describe('registerOpportunityHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBossWork.mockResolvedValue(undefined);
    mockBossSchedule.mockResolvedValue(undefined);
    mockSelectDistinct.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it('registers compute and reconcile handlers', async () => {
    const boss = createMockBoss();
    const { registerOpportunityHandlers } = await import('./opportunity.handler');
    await registerOpportunityHandlers(boss as unknown as PgBoss);

    expect(mockBossWork).toHaveBeenCalledTimes(2);
    expect(mockBossWork).toHaveBeenCalledWith(
      'opportunity-compute',
      expect.objectContaining({ localConcurrency: 2 }),
      expect.any(Function)
    );
    expect(mockBossWork).toHaveBeenCalledWith(
      'opportunity-daily-reconcile',
      expect.objectContaining({ localConcurrency: 1 }),
      expect.any(Function)
    );
    expect(mockBossSchedule).toHaveBeenCalledWith('opportunity-daily-reconcile', '0 5 * * *', {});
  });

  describe('compute handler', () => {
    async function getComputeHandler() {
      const boss = createMockBoss();
      const { registerOpportunityHandlers } = await import('./opportunity.handler');
      await registerOpportunityHandlers(boss as unknown as PgBoss);
      return mockBossWork.mock.calls[0][2];
    }

    it('calls computeOpportunities with correct args', async () => {
      mockComputeOpportunities.mockResolvedValueOnce({ changed: false, opportunityCount: 0 });
      const handler = await getComputeHandler();

      await handler([
        {
          id: 'job_1',
          data: { workspaceId: 'ws_test', promptSetId: 'ps_test', date: '2026-04-03' },
        },
      ]);

      expect(mockComputeOpportunities).toHaveBeenCalledWith({
        workspaceId: 'ws_test',
        promptSetId: 'ps_test',
        date: '2026-04-03',
      });
    });

    it('dispatches webhook when opportunities changed', async () => {
      mockComputeOpportunities.mockResolvedValueOnce({ changed: true, opportunityCount: 15 });
      mockDispatchWebhookEvent.mockResolvedValueOnce(undefined);
      const handler = await getComputeHandler();

      await handler([
        {
          id: 'job_1',
          data: { workspaceId: 'ws_test', promptSetId: 'ps_test', date: '2026-04-03' },
        },
      ]);

      expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
        'ws_test',
        'visibility.opportunities_updated',
        expect.objectContaining({
          opportunities: expect.objectContaining({
            workspaceId: 'ws_test',
            promptSetId: 'ps_test',
            date: '2026-04-03',
            totalOpportunities: 15,
          }),
        }),
        expect.anything()
      );
    });

    it('does NOT dispatch webhook when opportunities unchanged', async () => {
      mockComputeOpportunities.mockResolvedValueOnce({ changed: false, opportunityCount: 0 });
      const handler = await getComputeHandler();

      await handler([
        {
          id: 'job_1',
          data: { workspaceId: 'ws_test', promptSetId: 'ps_test', date: '2026-04-03' },
        },
      ]);

      expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
    });

    it('re-throws errors for pg-boss retry', async () => {
      mockComputeOpportunities.mockRejectedValueOnce(new Error('DB error'));
      const handler = await getComputeHandler();

      await expect(
        handler([
          {
            id: 'job_1',
            data: { workspaceId: 'ws_test', promptSetId: 'ps_test', date: '2026-04-03' },
          },
        ])
      ).rejects.toThrow('DB error');
    });
  });

  describe('reconcile handler', () => {
    async function getReconcileHandler() {
      const boss = createMockBoss();
      const { registerOpportunityHandlers } = await import('./opportunity.handler');
      await registerOpportunityHandlers(boss as unknown as PgBoss);
      return mockBossWork.mock.calls[1][2];
    }

    it('queries distinct workspace/promptSet pairs and enqueues compute jobs', async () => {
      mockWhere.mockResolvedValueOnce([
        { workspaceId: 'ws_1', promptSetId: 'ps_1' },
        { workspaceId: 'ws_2', promptSetId: 'ps_2' },
      ]);
      mockBossSend.mockResolvedValue(undefined);

      const handler = await getReconcileHandler();
      await handler([]);

      expect(mockBossSend).toHaveBeenCalledTimes(2);
      expect(mockBossSend).toHaveBeenCalledWith(
        'opportunity-compute',
        expect.objectContaining({
          workspaceId: 'ws_1',
          promptSetId: 'ps_1',
        })
      );
      expect(mockBossSend).toHaveBeenCalledWith(
        'opportunity-compute',
        expect.objectContaining({
          workspaceId: 'ws_2',
          promptSetId: 'ps_2',
        })
      );
    });
  });
});

describe('recommendation-share handler chains opportunity compute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBossWork.mockResolvedValue(undefined);
    mockBossSchedule.mockResolvedValue(undefined);
    mockSelectDistinct.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it('enqueues opportunity-compute after recommendation share completion', async () => {
    // Mock compute returning changed: true
    const mockComputeRecShare = vi.fn().mockResolvedValue({ changed: true });
    vi.doMock('./recommendation-share.compute', () => ({
      computeRecommendationShare: mockComputeRecShare,
    }));
    vi.doMock('@/modules/webhooks/webhook.service', () => ({
      dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
    }));

    const boss = createMockBoss();
    mockBossSend.mockResolvedValue(undefined);

    const { registerVisibilityHandlers } = await import('./recommendation-share.handler');
    await registerVisibilityHandlers(boss as unknown as PgBoss);

    // Get the compute handler (first work() call)
    const computeHandler = mockBossWork.mock.calls[0][2];

    await computeHandler([
      {
        id: 'job_1',
        data: { workspaceId: 'ws_test', promptSetId: 'ps_test', date: '2026-04-03' },
      },
    ]);

    // Should have called boss.send for opportunity-compute
    expect(mockBossSend).toHaveBeenCalledWith(
      'opportunity-compute',
      { workspaceId: 'ws_test', promptSetId: 'ps_test', date: '2026-04-03' },
      expect.objectContaining({
        singletonKey: 'opportunity:ws_test:ps_test:2026-04-03',
        singletonSeconds: 120,
      })
    );
  });
});
