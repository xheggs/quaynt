import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    chain.returning = vi.fn().mockResolvedValue([]);
    return chain;
  };
  return { db: { ...chainable(), transaction: vi.fn() } };
});

vi.mock('@/lib/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    REPORT_STORAGE_PATH: '/tmp/reports',
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

vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: vi.fn(({ page, limit }: { page: number; limit: number }) => ({
    limit,
    offset: (page - 1) * limit,
  })),
  countTotal: vi.fn().mockResolvedValue(0),
}));

describe('scheduled-report.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeNextRunAt', () => {
    it('computes next daily run in UTC', async () => {
      const { computeNextRunAt } = await import('./scheduled-report.service');

      const after = new Date('2026-04-07T10:00:00Z');
      const result = computeNextRunAt('daily', 9, 1, 1, 'UTC', after);

      // Next 9 AM UTC after 10 AM is tomorrow at 9 AM
      expect(result.getUTCHours()).toBe(9);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result > after).toBe(true);
    });

    it('computes next daily run in Europe/Berlin', async () => {
      const { computeNextRunAt } = await import('./scheduled-report.service');

      // April 7 2026, 6 AM UTC = 8 AM Berlin (CEST, UTC+2)
      const after = new Date('2026-04-07T06:00:00Z');
      const result = computeNextRunAt('daily', 9, 1, 1, 'Europe/Berlin', after);

      // Next 9 AM Berlin = 7 AM UTC (CEST)
      expect(result > after).toBe(true);
      expect(result.getUTCHours()).toBe(7);
    });

    it('computes next weekly run on Monday', async () => {
      const { computeNextRunAt } = await import('./scheduled-report.service');

      // April 7, 2026 is Tuesday
      const after = new Date('2026-04-07T10:00:00Z');
      const result = computeNextRunAt('weekly', 9, 1, 1, 'UTC', after);

      // Next Monday at 9 AM UTC = April 13
      expect(result > after).toBe(true);
      expect(result.getUTCDay()).toBe(1); // Monday
      expect(result.getUTCHours()).toBe(9);
    });

    it('computes next monthly run on the 15th', async () => {
      const { computeNextRunAt } = await import('./scheduled-report.service');

      const after = new Date('2026-04-16T10:00:00Z');
      const result = computeNextRunAt('monthly', 9, 1, 15, 'UTC', after);

      // Next 15th at 9 AM = May 15
      expect(result > after).toBe(true);
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCMonth()).toBe(4); // May (0-indexed)
    });

    it('handles dayOfMonth -1 (last day of month)', async () => {
      const { computeNextRunAt } = await import('./scheduled-report.service');

      // April 28, after the 28th
      const after = new Date('2026-04-29T10:00:00Z');
      const result = computeNextRunAt('monthly', 9, 1, -1, 'UTC', after);

      // Last day of April = 30
      expect(result > after).toBe(true);
      expect(result.getUTCHours()).toBe(9);
      // Could be April 30 or May 31 depending on timing
      const day = result.getUTCDate();
      const month = result.getUTCMonth();
      // Should be the last day of whatever month
      const daysInMonth = new Date(result.getUTCFullYear(), month + 1, 0).getDate();
      expect(day).toBe(daysInMonth);
    });

    it('always returns a future date', async () => {
      const { computeNextRunAt } = await import('./scheduled-report.service');

      const now = new Date();
      const result = computeNextRunAt('daily', 0, 0, 1, 'UTC', now);

      expect(result > now).toBe(true);
    });
  });

  describe('computeReportPeriod', () => {
    it('converts relative period to absolute dates', async () => {
      const { computeReportPeriod } = await import('./scheduled-report.service');

      const scope = {
        promptSetId: 'ps_test',
        brandIds: ['brand_test'],
        periodDays: 7,
      };

      const result = computeReportPeriod(scope);
      expect(result.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const fromDate = new Date(result.from);
      const toDate = new Date(result.to);
      const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });
  });

  describe('unsubscribe tokens', () => {
    it('round-trips a schedule unsubscribe token', async () => {
      const { generateScheduleUnsubscribeToken, validateScheduleUnsubscribeToken } =
        await import('./scheduled-report.service');

      const token = generateScheduleUnsubscribeToken('schrcpt_123', 'sched_456');
      const result = validateScheduleUnsubscribeToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.recipientId).toBe('schrcpt_123');
        expect(result.scheduleId).toBe('sched_456');
      }
    });

    it('rejects tampered tokens', async () => {
      const { generateScheduleUnsubscribeToken, validateScheduleUnsubscribeToken } =
        await import('./scheduled-report.service');

      const token = generateScheduleUnsubscribeToken('schrcpt_123', 'sched_456');
      const tampered = token.slice(0, -5) + 'XXXXX';
      const result = validateScheduleUnsubscribeToken(tampered);

      expect(result.valid).toBe(false);
    });

    it('rejects malformed tokens', async () => {
      const { validateScheduleUnsubscribeToken } = await import('./scheduled-report.service');

      expect(validateScheduleUnsubscribeToken('').valid).toBe(false);
      expect(validateScheduleUnsubscribeToken('no-dot-separator').valid).toBe(false);
      expect(validateScheduleUnsubscribeToken('invalid.base64').valid).toBe(false);
    });
  });
});
