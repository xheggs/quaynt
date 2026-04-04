// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgBoss } from 'pg-boss';

const mockComputeCitationSourceAggregate = vi.fn();
const mockDispatchWebhookEvent = vi.fn();
const mockBossWork = vi.fn();
const mockBossSend = vi.fn();
const mockBossSchedule = vi.fn();
const mockSelectDistinct = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();

vi.mock('./citation-source-aggregate.compute', () => ({
  computeCitationSourceAggregate: (...args: unknown[]) =>
    mockComputeCitationSourceAggregate(...args),
}));

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...args: unknown[]) => mockDispatchWebhookEvent(...args),
}));

vi.mock('@/lib/db', () => ({
  db: {
    selectDistinct: (...a: unknown[]) => mockSelectDistinct(...a),
  },
}));

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    workspaceId: 'workspaceId',
    modelRunId: 'modelRunId',
    createdAt: 'createdAt',
    domain: 'domain',
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

describe('registerCitationSourceHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBossWork.mockResolvedValue(undefined);
    mockBossSchedule.mockResolvedValue(undefined);
    mockSelectDistinct.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
  });

  it('registers compute and reconcile handlers with correct schedule', async () => {
    const boss = createMockBoss();
    const { registerCitationSourceHandlers } = await import('./citation-source-aggregate.handler');
    await registerCitationSourceHandlers(boss as unknown as PgBoss);

    expect(mockBossWork).toHaveBeenCalledTimes(2);
    expect(mockBossWork).toHaveBeenCalledWith(
      'citation-source-compute',
      expect.objectContaining({ localConcurrency: 2 }),
      expect.any(Function)
    );
    expect(mockBossWork).toHaveBeenCalledWith(
      'citation-source-daily-reconcile',
      expect.objectContaining({ localConcurrency: 1 }),
      expect.any(Function)
    );
    expect(mockBossSchedule).toHaveBeenCalledWith(
      'citation-source-daily-reconcile',
      '0 3 * * *',
      {}
    );
  });

  describe('compute handler', () => {
    async function getComputeHandler() {
      const boss = createMockBoss();
      const { registerCitationSourceHandlers } =
        await import('./citation-source-aggregate.handler');
      await registerCitationSourceHandlers(boss as unknown as PgBoss);
      return mockBossWork.mock.calls[0][2];
    }

    it('calls computeCitationSourceAggregate with correct args', async () => {
      mockComputeCitationSourceAggregate.mockResolvedValueOnce({ changed: false });
      const handler = await getComputeHandler();

      await handler([
        {
          id: 'job_1',
          data: { workspaceId: 'ws_test', promptSetId: 'ps_test', date: '2026-04-03' },
        },
      ]);

      expect(mockComputeCitationSourceAggregate).toHaveBeenCalledWith({
        workspaceId: 'ws_test',
        promptSetId: 'ps_test',
        date: '2026-04-03',
      });
    });

    it('dispatches webhook when aggregates changed', async () => {
      mockComputeCitationSourceAggregate.mockResolvedValueOnce({ changed: true });
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
        'visibility.citation_sources_updated',
        expect.objectContaining({
          citationSources: expect.objectContaining({
            workspaceId: 'ws_test',
            promptSetId: 'ps_test',
            date: '2026-04-03',
          }),
        }),
        expect.anything()
      );
    });

    it('does NOT dispatch webhook when aggregates unchanged', async () => {
      mockComputeCitationSourceAggregate.mockResolvedValueOnce({ changed: false });
      const handler = await getComputeHandler();

      await handler([
        {
          id: 'job_1',
          data: { workspaceId: 'ws_test', promptSetId: 'ps_test', date: '2026-04-03' },
        },
      ]);

      expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
    });

    it('handles errors gracefully (re-throws for pg-boss retry)', async () => {
      mockComputeCitationSourceAggregate.mockRejectedValueOnce(new Error('DB error'));
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
      const { registerCitationSourceHandlers } =
        await import('./citation-source-aggregate.handler');
      await registerCitationSourceHandlers(boss as unknown as PgBoss);
      return mockBossWork.mock.calls[1][2];
    }

    it('queries yesterday citations and enqueues compute jobs', async () => {
      mockWhere.mockResolvedValueOnce([
        { workspaceId: 'ws_1', promptSetId: 'ps_1' },
        { workspaceId: 'ws_2', promptSetId: 'ps_2' },
      ]);
      mockBossSend.mockResolvedValue(undefined);

      const handler = await getReconcileHandler();
      await handler([]);

      expect(mockBossSend).toHaveBeenCalledTimes(2);
      expect(mockBossSend).toHaveBeenCalledWith(
        'citation-source-compute',
        expect.objectContaining({
          workspaceId: 'ws_1',
          promptSetId: 'ps_1',
        })
      );
    });
  });
});
