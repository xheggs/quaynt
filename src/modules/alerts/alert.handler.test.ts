// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    selectDistinct: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

vi.mock('./alert.schema', () => ({
  alertRule: {
    workspaceId: 'workspaceId',
    promptSetId: 'promptSetId',
    enabled: 'enabled',
  },
}));

const mockEvaluateRulesForMetric = vi.fn().mockResolvedValue([]);

vi.mock('./alert.evaluator', () => ({
  evaluateRulesForMetric: (...args: unknown[]) => mockEvaluateRulesForMetric(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

describe('alert handler', () => {
  const mockBoss = {
    work: vi.fn(),
    schedule: vi.fn(),
    send: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerAlertHandlers', () => {
    it('registers alert-evaluate and alert-daily-reconcile handlers and schedules daily cron', async () => {
      const { registerAlertHandlers } = await import('./alert.handler');
      await registerAlertHandlers(mockBoss as never);

      // Should register 2 workers
      expect(mockBoss.work).toHaveBeenCalledTimes(2);

      // First: alert-evaluate
      expect(mockBoss.work).toHaveBeenCalledWith(
        'alert-evaluate',
        expect.objectContaining({ includeMetadata: true, localConcurrency: 2 }),
        expect.any(Function)
      );

      // Second: alert-daily-reconcile
      expect(mockBoss.work).toHaveBeenCalledWith(
        'alert-daily-reconcile',
        expect.objectContaining({ includeMetadata: true, localConcurrency: 1 }),
        expect.any(Function)
      );

      // Should schedule daily at 07:00 UTC
      expect(mockBoss.schedule).toHaveBeenCalledWith('alert-daily-reconcile', '0 7 * * *', {});
    });
  });

  describe('alert-evaluate handler', () => {
    it('forwards job data to evaluateRulesForMetric', async () => {
      mockEvaluateRulesForMetric.mockResolvedValueOnce([
        { ruleId: 'alert_1', reason: 'triggered' },
      ]);

      const { registerAlertHandlers } = await import('./alert.handler');
      await registerAlertHandlers(mockBoss as never);

      // Get the handler function from the first work() call
      const handler = mockBoss.work.mock.calls[0][2];

      await handler([
        {
          id: 'job_123',
          data: {
            workspaceId: 'ws_test',
            promptSetId: 'ps_test',
            metric: 'recommendation_share',
            date: '2026-04-02',
          },
        },
      ]);

      expect(mockEvaluateRulesForMetric).toHaveBeenCalledWith(
        'ws_test',
        'ps_test',
        'recommendation_share',
        '2026-04-02',
        mockBoss
      );
    });

    it('rethrows errors for pg-boss retry', async () => {
      mockEvaluateRulesForMetric.mockRejectedValueOnce(new Error('DB failure'));

      const { registerAlertHandlers } = await import('./alert.handler');
      await registerAlertHandlers(mockBoss as never);

      const handler = mockBoss.work.mock.calls[0][2];

      await expect(
        handler([
          {
            id: 'job_123',
            data: {
              workspaceId: 'ws_test',
              promptSetId: 'ps_test',
              metric: 'recommendation_share',
              date: '2026-04-02',
            },
          },
        ])
      ).rejects.toThrow('DB failure');
    });
  });

  describe('alert-daily-reconcile handler', () => {
    it('enqueues evaluate jobs for each workspace/promptSet/metric combo', async () => {
      const { db } = await import('@/lib/db');
      (db.selectDistinct as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { workspaceId: 'ws_1', promptSetId: 'ps_1' },
            { workspaceId: 'ws_2', promptSetId: 'ps_2' },
          ]),
        })),
      });

      const { registerAlertHandlers } = await import('./alert.handler');
      await registerAlertHandlers(mockBoss as never);

      // Get the reconcile handler (second work() call)
      const handler = mockBoss.work.mock.calls[1][2];
      await handler([{ id: 'job_reconcile', data: {} }]);

      // 2 workspace/promptSet pairs x 6 metrics = 12 sends
      expect(mockBoss.send).toHaveBeenCalledTimes(12);

      // Verify singleton dedup keys
      expect(mockBoss.send).toHaveBeenCalledWith(
        'alert-evaluate',
        expect.objectContaining({
          workspaceId: 'ws_1',
          promptSetId: 'ps_1',
          metric: 'recommendation_share',
        }),
        expect.objectContaining({
          singletonKey: expect.stringContaining('alert:ws_1:recommendation_share:'),
          singletonSeconds: 120,
        })
      );
    });
  });
});
