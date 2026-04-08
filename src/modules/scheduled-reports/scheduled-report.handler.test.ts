import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgBoss } from 'pg-boss';

// --- Mocks ---

vi.mock('@/lib/db', () => {
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select',
      'from',
      'where',
      'limit',
      'offset',
      'orderBy',
      'insert',
      'values',
      'onConflictDoNothing',
      'returning',
      'update',
      'set',
      'delete',
      'innerJoin',
      'leftJoin',
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.limit = vi.fn().mockResolvedValue([]);
    chain.returning = vi.fn().mockResolvedValue([{ id: 'rptdlv_test' }]);
    return chain;
  };
  return { db: chainable() };
});

vi.mock('@/lib/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    REPORT_STORAGE_PATH: '/tmp/reports',
    QUAYNT_EDITION: 'community',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock('@/lib/db/id', () => ({
  generatePrefixedId: vi.fn((prefix: string) => `${prefix}_test123`),
}));

const mockGetDueSchedules = vi.fn().mockResolvedValue([]);
const mockAdvanceScheduleNextRun = vi.fn().mockResolvedValue(undefined);
const mockMarkScheduleSuccess = vi.fn().mockResolvedValue(undefined);
const mockMarkScheduleFailure = vi.fn().mockResolvedValue({ failures: 1, autoDisabled: false });
const mockGetActiveRecipients = vi.fn().mockResolvedValue([]);
const mockComputeReportPeriod = vi.fn().mockReturnValue({ from: '2026-04-01', to: '2026-04-07' });
const mockGenerateScheduleUnsubscribeToken = vi.fn().mockReturnValue('mock_token');

vi.mock('./scheduled-report.service', () => ({
  getDueSchedules: (...args: unknown[]) => mockGetDueSchedules(...args),
  advanceScheduleNextRun: (...args: unknown[]) => mockAdvanceScheduleNextRun(...args),
  markScheduleSuccess: (...args: unknown[]) => mockMarkScheduleSuccess(...args),
  markScheduleFailure: (...args: unknown[]) => mockMarkScheduleFailure(...args),
  getActiveRecipients: (...args: unknown[]) => mockGetActiveRecipients(...args),
  computeReportPeriod: (...args: unknown[]) => mockComputeReportPeriod(...args),
  generateScheduleUnsubscribeToken: (...args: unknown[]) =>
    mockGenerateScheduleUnsubscribeToken(...args),
}));

vi.mock('@/modules/pdf/pdf-generator.service', () => ({
  generatePdfReport: vi.fn().mockResolvedValue({
    filePath: '/tmp/reports/test.pdf',
    fileSizeBytes: 500_000,
    pageCount: 5,
  }),
}));

vi.mock('@/modules/pdf/report-job.schema', () => ({
  reportJob: {
    id: 'id',
    workspaceId: 'workspaceId',
    status: 'status',
  },
}));

vi.mock('@/modules/exports/export.fetchers', () => ({
  fetchExportData: vi.fn().mockResolvedValue({
    rows: (async function* () {
      yield { metric: 'test', value: 1 };
    })(),
    truncated: false,
  }),
}));

vi.mock('@/modules/exports/csv-formatter.service', () => ({
  formatCsv: vi.fn().mockReturnValue(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('col1,col2\nval1,val2'));
        controller.close();
      },
    })
  ),
}));

vi.mock('@/modules/exports/json-formatter.service', () => ({
  formatJson: vi.fn().mockReturnValue(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"data":[]}'));
        controller.close();
      },
    })
  ),
  buildJsonMeta: vi.fn().mockReturnValue({}),
}));

vi.mock('@/modules/exports/export.columns', () => ({
  exportColumns: { report: [{ key: 'metric', i18nKey: 'test' }] },
}));

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/modules/notifications/email/email.transport', () => ({
  createEmailTransport: vi.fn().mockReturnValue(null),
}));

vi.mock('./scheduled-report.render', () => ({
  renderScheduledReportEmail: vi.fn().mockResolvedValue({
    subject: 'Test Report',
    html: '<html>test</html>',
    text: 'test',
    headers: { 'List-Unsubscribe': '<http://test>' },
  }),
}));

vi.mock('./scheduled-report.schema', () => ({
  reportSchedule: {
    id: 'id',
    workspaceId: 'ws',
    enabled: 'enabled',
    deletedAt: 'deletedAt',
    nextRunAt: 'nextRunAt',
  },
  reportDelivery: { id: 'id', scheduleId: 'scheduleId', createdAt: 'createdAt' },
  scheduleRecipient: { id: 'id', scheduleId: 'scheduleId', unsubscribed: 'unsubscribed' },
}));

vi.mock('@/modules/workspace/workspace.service', () => ({
  getWorkspaceById: vi.fn().mockResolvedValue({ id: 'ws_test', name: 'Test Workspace' }),
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>test</html>'),
  toPlainText: vi.fn().mockReturnValue('test'),
}));

// Mock fs
vi.mock('node:fs', async () => {
  const fsMock = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue({
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }),
    readFile: vi.fn().mockResolvedValue(Buffer.from('pdf-content')),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ mtime: new Date() }),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
  return {
    default: { promises: fsMock },
    promises: fsMock,
  };
});

describe('scheduled-report.handler', () => {
  let mockBoss: PgBoss;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBoss = {
      work: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue('job-id'),
      schedule: vi.fn().mockResolvedValue(undefined),
    } as unknown as PgBoss;
  });

  describe('registerScheduledReportHandlers', () => {
    it('registers all handlers and cron schedules', async () => {
      const { registerScheduledReportHandlers } = await import('./scheduled-report.handler');

      await registerScheduledReportHandlers(mockBoss);

      expect(mockBoss.work).toHaveBeenCalledTimes(3);
      expect(mockBoss.schedule).toHaveBeenCalledTimes(2);

      // Verify job names
      const workCalls = vi.mocked(mockBoss.work).mock.calls;
      expect(workCalls[0][0]).toBe('scheduled-report-tick');
      expect(workCalls[1][0]).toBe('scheduled-report-generate');
      expect(workCalls[2][0]).toBe('scheduled-report-cleanup');

      // Verify cron schedules
      const scheduleCalls = vi.mocked(mockBoss.schedule).mock.calls;
      expect(scheduleCalls[0][0]).toBe('scheduled-report-tick');
      expect(scheduleCalls[0][1]).toBe('0 * * * *');
      expect(scheduleCalls[1][0]).toBe('scheduled-report-cleanup');
      expect(scheduleCalls[1][1]).toBe('0 4 * * *');
    });
  });

  describe('SchedulePermanentError', () => {
    it('is classified as permanent', async () => {
      const { SchedulePermanentError, PERMANENT_ERROR_CODES } =
        await import('./scheduled-report.types');

      const err = new SchedulePermanentError('Brands not found', 'BRANDS_NOT_FOUND');
      expect(err.name).toBe('SchedulePermanentError');
      expect(err.code).toBe('BRANDS_NOT_FOUND');
      expect(PERMANENT_ERROR_CODES.has('BRANDS_NOT_FOUND')).toBe(true);
      expect(PERMANENT_ERROR_CODES.has('WORKSPACE_NOT_FOUND')).toBe(true);
      expect(PERMANENT_ERROR_CODES.has('INVALID_SCOPE')).toBe(true);
    });
  });
});
