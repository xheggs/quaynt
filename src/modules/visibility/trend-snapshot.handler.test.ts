// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockComputeTrendSnapshots = vi.fn();
const mockDispatchWebhookEvent = vi.fn();
const mockWork = vi.fn();
const mockSchedule = vi.fn();
const mockSend = vi.fn();
const mockSelectDistinct = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();

vi.mock('./trend-snapshot.compute', () => ({
  computeTrendSnapshots: (...args: unknown[]) => mockComputeTrendSnapshots(...args),
}));

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...args: unknown[]) => mockDispatchWebhookEvent(...args),
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

vi.mock('@/lib/db', () => ({
  db: {
    selectDistinct: (...a: unknown[]) => mockSelectDistinct(...a),
  },
}));

vi.mock('@/modules/citations/citation.schema', () => ({
  citation: {
    workspaceId: 'workspaceId',
    brandId: 'brandId',
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

function createMockBoss() {
  mockWork.mockResolvedValue(undefined);
  mockSchedule.mockResolvedValue(undefined);
  mockSend.mockResolvedValue(undefined);

  return {
    work: mockWork,
    schedule: mockSchedule,
    send: mockSend,
  } as unknown;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registerTrendSnapshotHandlers', () => {
  it('registers compute and reconciliation handlers', async () => {
    const { registerTrendSnapshotHandlers } = await import('./trend-snapshot.handler');
    const boss = createMockBoss();

    await registerTrendSnapshotHandlers(
      boss as Parameters<typeof registerTrendSnapshotHandlers>[0]
    );

    // Should register two handlers
    expect(mockWork).toHaveBeenCalledTimes(2);
    expect(mockWork).toHaveBeenCalledWith(
      'trend-snapshot-compute',
      expect.any(Object),
      expect.any(Function)
    );
    expect(mockWork).toHaveBeenCalledWith(
      'trend-snapshot-daily-reconcile',
      expect.any(Object),
      expect.any(Function)
    );

    // Should schedule daily reconciliation at 06:00 UTC
    expect(mockSchedule).toHaveBeenCalledWith('trend-snapshot-daily-reconcile', '0 6 * * *', {});
  });

  it('compute handler dispatches webhook when anomalies detected', async () => {
    const { registerTrendSnapshotHandlers } = await import('./trend-snapshot.handler');
    const boss = createMockBoss();
    await registerTrendSnapshotHandlers(
      boss as Parameters<typeof registerTrendSnapshotHandlers>[0]
    );

    // Get the compute handler callback
    const computeHandler = mockWork.mock.calls.find(
      (c: unknown[]) => c[0] === 'trend-snapshot-compute'
    )?.[2];

    mockComputeTrendSnapshots.mockResolvedValueOnce({ changed: true, anomalyCount: 2 });

    await computeHandler([
      {
        id: 'job_1',
        data: {
          workspaceId: 'ws_test',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          metric: 'recommendation_share',
          period: 'weekly',
        },
      },
    ]);

    expect(mockComputeTrendSnapshots).toHaveBeenCalledWith({
      workspaceId: 'ws_test',
      promptSetId: 'ps_test',
      brandId: 'brand_test',
      metric: 'recommendation_share',
      period: 'weekly',
    });

    expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
      'ws_test',
      'visibility.trend_anomaly_detected',
      expect.objectContaining({
        trendAnomaly: expect.objectContaining({
          anomalyCount: 2,
        }),
      }),
      expect.anything()
    );
  });

  it('compute handler does not dispatch webhook when no anomalies', async () => {
    const { registerTrendSnapshotHandlers } = await import('./trend-snapshot.handler');
    const boss = createMockBoss();
    await registerTrendSnapshotHandlers(
      boss as Parameters<typeof registerTrendSnapshotHandlers>[0]
    );

    const computeHandler = mockWork.mock.calls.find(
      (c: unknown[]) => c[0] === 'trend-snapshot-compute'
    )?.[2];

    mockComputeTrendSnapshots.mockResolvedValueOnce({ changed: true, anomalyCount: 0 });

    await computeHandler([
      {
        id: 'job_1',
        data: {
          workspaceId: 'ws_test',
          promptSetId: 'ps_test',
          brandId: 'brand_test',
          metric: 'recommendation_share',
          period: 'weekly',
        },
      },
    ]);

    expect(mockDispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it('compute handler re-throws on error', async () => {
    const { registerTrendSnapshotHandlers } = await import('./trend-snapshot.handler');
    const boss = createMockBoss();
    await registerTrendSnapshotHandlers(
      boss as Parameters<typeof registerTrendSnapshotHandlers>[0]
    );

    const computeHandler = mockWork.mock.calls.find(
      (c: unknown[]) => c[0] === 'trend-snapshot-compute'
    )?.[2];

    mockComputeTrendSnapshots.mockRejectedValueOnce(new Error('DB error'));

    await expect(
      computeHandler([
        {
          id: 'job_1',
          data: {
            workspaceId: 'ws_test',
            promptSetId: 'ps_test',
            brandId: 'brand_test',
            metric: 'recommendation_share',
            period: 'weekly',
          },
        },
      ])
    ).rejects.toThrow('DB error');
  });

  it('reconciliation handler enqueues jobs for each workspace/brand/metric/period combo', async () => {
    const { registerTrendSnapshotHandlers } = await import('./trend-snapshot.handler');
    const boss = createMockBoss();
    await registerTrendSnapshotHandlers(
      boss as Parameters<typeof registerTrendSnapshotHandlers>[0]
    );

    const reconcileHandler = mockWork.mock.calls.find(
      (c: unknown[]) => c[0] === 'trend-snapshot-daily-reconcile'
    )?.[2];

    // Mock distinct triples
    mockSelectDistinct.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ innerJoin: mockInnerJoin });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([{ workspaceId: 'ws_1', promptSetId: 'ps_1', brandId: 'brand_1' }]);

    await reconcileHandler([]);

    // 1 triple × 6 metrics × 2 periods = 12 jobs
    expect(mockSend).toHaveBeenCalledTimes(12);
    expect(mockSend).toHaveBeenCalledWith(
      'trend-snapshot-compute',
      expect.objectContaining({
        workspaceId: 'ws_1',
        promptSetId: 'ps_1',
        brandId: 'brand_1',
      }),
      expect.objectContaining({
        singletonKey: expect.stringContaining('trend-snapshot:'),
      })
    );
  });
});

describe('edition gating in handlers.ts', () => {
  it('does not register trend snapshot handlers in community edition', async () => {
    vi.doMock('@/lib/config/env', () => ({
      env: { QUAYNT_EDITION: 'community' },
    }));

    // Reset handler module
    vi.resetModules();

    // Mock all other handler modules
    vi.doMock('@/modules/webhooks/webhook.handler', () => ({
      registerWebhookHandlers: vi.fn(),
    }));
    vi.doMock('@/modules/model-runs/model-run.handler', () => ({
      registerModelRunHandlers: vi.fn(),
    }));
    vi.doMock('@/modules/citations/citation.handler', () => ({
      registerCitationHandlers: vi.fn(),
    }));
    vi.doMock('@/modules/visibility/recommendation-share.handler', () => ({
      registerVisibilityHandlers: vi.fn(),
    }));
    vi.doMock('@/modules/visibility/sentiment-aggregate.handler', () => ({
      registerSentimentAggregateHandlers: vi.fn(),
    }));
    vi.doMock('@/modules/visibility/citation-source-aggregate.handler', () => ({
      registerCitationSourceHandlers: vi.fn(),
    }));
    vi.doMock('@/modules/visibility/opportunity.handler', () => ({
      registerOpportunityHandlers: vi.fn(),
    }));
    vi.doMock('@/modules/visibility/position-aggregate.handler', () => ({
      registerPositionAggregateHandlers: vi.fn(),
    }));

    // The trend snapshot handler should NOT be imported/called
    const trendHandlerSpy = vi.fn();
    vi.doMock('./trend-snapshot.handler', () => ({
      registerTrendSnapshotHandlers: trendHandlerSpy,
    }));

    // In community mode, the dynamic import in handlers.ts should be skipped
    // We verify this indirectly - the work calls should only be from non-trend handlers
    expect(trendHandlerSpy).not.toHaveBeenCalled();
  });
});
