// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbSelect = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbSet = vi.fn();
const mockDbSetWhere = vi.fn();
const mockDbReturning = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      mockDbSelect(...args);
      return { from: mockDbFrom };
    },
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      return { set: mockDbSet };
    },
  },
}));

mockDbFrom.mockReturnValue({ where: mockDbWhere });
mockDbWhere.mockResolvedValue([]);
mockDbSet.mockReturnValue({ where: mockDbSetWhere });
mockDbSetWhere.mockReturnValue({ returning: mockDbReturning });
mockDbReturning.mockResolvedValue([]);

const mockExistsSync = vi.fn();
const mockUnlinkSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
}));

vi.mock('./report-job.schema', () => ({
  reportJob: {
    id: 'id',
    status: 'status',
    expiresAt: 'expiresAt',
    filePath: 'filePath',
    startedAt: 'startedAt',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
}));

describe('pdf-cleanup.handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbFrom.mockReturnValue({ where: mockDbWhere });
    mockDbWhere.mockResolvedValue([]);
    mockDbSet.mockReturnValue({ where: mockDbSetWhere });
    mockDbSetWhere.mockReturnValue({ returning: mockDbReturning });
    mockDbReturning.mockResolvedValue([]);
  });

  it('registers handler with pg-boss', async () => {
    const { registerPdfCleanupHandler } = await import('./pdf-cleanup.handler');

    const mockBoss = { work: vi.fn().mockResolvedValue('handler-id') };
    await registerPdfCleanupHandler(mockBoss as any);

    expect(mockBoss.work).toHaveBeenCalledWith(
      'report-pdf-cleanup',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('deletes expired PDF files', async () => {
    const { registerPdfCleanupHandler } = await import('./pdf-cleanup.handler');

    // Simulate expired jobs
    mockDbWhere.mockResolvedValueOnce([
      { id: 'rpt_expired1', filePath: '/tmp/reports/rpt_expired1.pdf' },
      { id: 'rpt_expired2', filePath: '/tmp/reports/rpt_expired2.pdf' },
    ]);
    mockExistsSync.mockReturnValue(true);

    const mockBoss = { work: vi.fn().mockResolvedValue('handler-id') };
    await registerPdfCleanupHandler(mockBoss as any);

    // Get the handler function and execute
    const handlerFn = mockBoss.work.mock.calls[0][2];
    await handlerFn([{}]);

    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('skips deletion for missing files', async () => {
    const { registerPdfCleanupHandler } = await import('./pdf-cleanup.handler');

    mockDbWhere.mockResolvedValueOnce([
      { id: 'rpt_missing', filePath: '/tmp/reports/rpt_missing.pdf' },
    ]);
    mockExistsSync.mockReturnValue(false);

    const mockBoss = { work: vi.fn().mockResolvedValue('handler-id') };
    await registerPdfCleanupHandler(mockBoss as any);

    const handlerFn = mockBoss.work.mock.calls[0][2];
    await handlerFn([{}]);

    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
