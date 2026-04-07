// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbUpdate = vi.fn();
const mockDbSet = vi.fn();
const mockDbWhere = vi.fn();
const mockDbReturning = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      return { set: mockDbSet };
    },
  },
}));

mockDbSet.mockReturnValue({ where: mockDbWhere });
mockDbWhere.mockReturnValue({ returning: mockDbReturning });
mockDbReturning.mockResolvedValue([]);

const mockGeneratePdfReport = vi.fn();
vi.mock('./pdf-generator.service', () => ({
  generatePdfReport: (...args: unknown[]) => mockGeneratePdfReport(...args),
}));

const mockDispatchWebhookEvent = vi.fn();
vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: (...args: unknown[]) => mockDispatchWebhookEvent(...args),
}));

vi.mock('./report-job.schema', () => ({
  reportJob: { id: 'id', status: 'status', workspaceId: 'workspaceId' },
}));

const mockLog = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), child: vi.fn() };
mockLog.child.mockReturnValue(mockLog);

vi.mock('@/lib/logger', () => ({
  logger: { child: () => mockLog },
}));

vi.mock('@/lib/config/env', () => ({
  env: { REPORT_STORAGE_PATH: '/tmp/reports' },
}));

vi.mock('./pdf-cleanup.handler', () => ({
  registerPdfCleanupHandler: vi.fn(),
}));

describe('pdf.handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSet.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockReturnValue({ returning: mockDbReturning });
    mockDbReturning.mockResolvedValue([]);
    mockDispatchWebhookEvent.mockResolvedValue(undefined);
  });

  describe('registerPdfHandlers', () => {
    it('registers handler with pg-boss', async () => {
      const { registerPdfHandlers } = await import('./pdf.handler');

      const mockBoss = {
        work: vi.fn().mockResolvedValue('handler-id'),
        schedule: vi.fn().mockResolvedValue(undefined),
      };

      await registerPdfHandlers(mockBoss as any);

      expect(mockBoss.work).toHaveBeenCalledWith(
        'report-pdf-generate',
        expect.objectContaining({
          includeMetadata: true,
          localConcurrency: 2,
        }),
        expect.any(Function)
      );
    });

    it('schedules cleanup cron', async () => {
      const { registerPdfHandlers } = await import('./pdf.handler');

      const mockBoss = {
        work: vi.fn().mockResolvedValue('handler-id'),
        schedule: vi.fn().mockResolvedValue(undefined),
      };

      await registerPdfHandlers(mockBoss as any);

      expect(mockBoss.schedule).toHaveBeenCalledWith(
        'report-pdf-cleanup',
        '0 3 * * *',
        {},
        expect.any(Object)
      );
    });
  });

  describe('processReportPdfJob (via handler)', () => {
    it('updates job to completed on success', async () => {
      const { registerPdfHandlers } = await import('./pdf.handler');

      mockGeneratePdfReport.mockResolvedValue({
        filePath: '/tmp/reports/rpt_test.pdf',
        fileSizeBytes: 50000,
        pageCount: 5,
      });

      const mockBoss = {
        work: vi.fn().mockResolvedValue('handler-id'),
        schedule: vi.fn().mockResolvedValue(undefined),
      };

      await registerPdfHandlers(mockBoss as any);

      // Get the handler function
      const handlerFn = mockBoss.work.mock.calls[0][2];

      // Simulate a job
      const job = {
        data: {
          jobId: 'rpt_test',
          workspaceId: 'ws_1',
          workspaceName: 'Test',
          scope: { promptSetId: 'ps_1', brandIds: ['brand_1'] },
          locale: 'en',
        },
        retryCount: 0,
      };

      await handlerFn([job]);

      // Should have updated status to processing, then completed
      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockDbSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'processing' }));
      expect(mockDbSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    });

    it('fires webhook on success', async () => {
      const { registerPdfHandlers } = await import('./pdf.handler');

      mockGeneratePdfReport.mockResolvedValue({
        filePath: '/tmp/reports/rpt_test.pdf',
        fileSizeBytes: 50000,
        pageCount: 5,
      });

      const mockBoss = {
        work: vi.fn().mockResolvedValue('handler-id'),
        schedule: vi.fn().mockResolvedValue(undefined),
      };

      await registerPdfHandlers(mockBoss as any);
      const handlerFn = mockBoss.work.mock.calls[0][2];

      await handlerFn([
        {
          data: {
            jobId: 'rpt_test',
            workspaceId: 'ws_1',
            workspaceName: 'Test',
            scope: { promptSetId: 'ps_1', brandIds: ['brand_1'] },
            locale: 'en',
          },
          retryCount: 0,
        },
      ]);

      expect(mockDispatchWebhookEvent).toHaveBeenCalledWith(
        'ws_1',
        'report.generated',
        expect.objectContaining({
          report: expect.objectContaining({ id: 'rpt_test' }),
        }),
        mockBoss
      );
    });

    it('sets failed status on permanent error without throwing', async () => {
      const { registerPdfHandlers } = await import('./pdf.handler');
      const { PdfPermanentError } = await import('./pdf.types');

      mockGeneratePdfReport.mockRejectedValue(new PdfPermanentError('No data'));

      const mockBoss = {
        work: vi.fn().mockResolvedValue('handler-id'),
        schedule: vi.fn().mockResolvedValue(undefined),
      };

      await registerPdfHandlers(mockBoss as any);
      const handlerFn = mockBoss.work.mock.calls[0][2];

      // Should NOT throw — permanent errors are swallowed
      await handlerFn([
        {
          data: {
            jobId: 'rpt_perm_fail',
            workspaceId: 'ws_1',
            workspaceName: 'Test',
            scope: { promptSetId: 'ps_1', brandIds: ['brand_1'] },
            locale: 'en',
          },
          retryCount: 0,
        },
      ]);

      expect(mockDbSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'No data',
        })
      );
    });

    it('throws on transient error to trigger retry', async () => {
      const { registerPdfHandlers } = await import('./pdf.handler');

      mockGeneratePdfReport.mockRejectedValue(new Error('Network timeout'));

      const mockBoss = {
        work: vi.fn().mockResolvedValue('handler-id'),
        schedule: vi.fn().mockResolvedValue(undefined),
      };

      await registerPdfHandlers(mockBoss as any);
      const handlerFn = mockBoss.work.mock.calls[0][2];

      await expect(
        handlerFn([
          {
            data: {
              jobId: 'rpt_trans_fail',
              workspaceId: 'ws_1',
              workspaceName: 'Test',
              scope: { promptSetId: 'ps_1', brandIds: ['brand_1'] },
              locale: 'en',
            },
            retryCount: 0,
          },
        ])
      ).rejects.toThrow('Network timeout');
    });
  });
});
