// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/config/env', () => ({
  env: { REPORT_STORAGE_PATH: '/tmp/test-reports' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockUnlink = vi.fn();
const mockExistsSync = vi.fn();

vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

describe('template-logo-cleanup.handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnlink.mockResolvedValue(undefined);
  });

  it('exports registerLogoCleanupHandler', async () => {
    const { registerLogoCleanupHandler } = await import('./template-logo-cleanup.handler');
    expect(registerLogoCleanupHandler).toBeDefined();
    expect(typeof registerLogoCleanupHandler).toBe('function');
  });

  it('registers with pg-boss work and schedule', async () => {
    const mockBoss = {
      work: vi.fn().mockResolvedValue(undefined),
      schedule: vi.fn().mockResolvedValue(undefined),
    };

    const { registerLogoCleanupHandler } = await import('./template-logo-cleanup.handler');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- simplified mock for test
    await registerLogoCleanupHandler(mockBoss as any);

    expect(mockBoss.work).toHaveBeenCalledWith(
      'report-template-logo-cleanup',
      expect.any(Object),
      expect.any(Function)
    );
    expect(mockBoss.schedule).toHaveBeenCalledWith(
      'report-template-logo-cleanup',
      '0 5 * * *',
      expect.any(Object),
      expect.any(Object)
    );
  });
});
