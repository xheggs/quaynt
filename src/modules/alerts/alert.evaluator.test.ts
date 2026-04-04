// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

// Mock modules that trigger env validation on import
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/modules/notifications/notification.service', () => ({
  dispatchAlertEmail: vi.fn(),
  dispatchAlertWebhook: vi.fn(),
}));

import { evaluateCondition, isCooldownActive } from './alert.evaluator';

describe('evaluateCondition', () => {
  describe('drops_below', () => {
    it('returns true when value is below threshold', () => {
      expect(evaluateCondition('drops_below', 15, null, 20, 'any').conditionMet).toBe(true);
    });

    it('returns false when value is above threshold', () => {
      expect(evaluateCondition('drops_below', 25, null, 20, 'any').conditionMet).toBe(false);
    });

    it('returns false when value equals threshold (not strictly below)', () => {
      expect(evaluateCondition('drops_below', 20, null, 20, 'any').conditionMet).toBe(false);
    });
  });

  describe('exceeds', () => {
    it('returns true when value is above threshold', () => {
      expect(evaluateCondition('exceeds', 25, null, 20, 'any').conditionMet).toBe(true);
    });

    it('returns false when value is below threshold', () => {
      expect(evaluateCondition('exceeds', 15, null, 20, 'any').conditionMet).toBe(false);
    });

    it('returns false when value equals threshold (not strictly above)', () => {
      expect(evaluateCondition('exceeds', 20, null, 20, 'any').conditionMet).toBe(false);
    });
  });

  describe('changes_by_percent', () => {
    it('returns false when previousValue is null', () => {
      expect(evaluateCondition('changes_by_percent', 30, null, 20, 'any').conditionMet).toBe(false);
    });

    describe('direction: any', () => {
      it('returns true when absolute change rate exceeds threshold (drop)', () => {
        // 30 vs 40: delta = -10, changeRate = -25%
        const result = evaluateCondition('changes_by_percent', 30, 40, 20, 'any');
        expect(result.conditionMet).toBe(true);
        expect(result.changeRate).toBeCloseTo(-25);
      });

      it('returns true when absolute change rate exceeds threshold (increase)', () => {
        // 50 vs 40: delta = 10, changeRate = 25%
        const result = evaluateCondition('changes_by_percent', 50, 40, 20, 'any');
        expect(result.conditionMet).toBe(true);
        expect(result.changeRate).toBeCloseTo(25);
      });

      it('returns false when change rate is below threshold', () => {
        // 38 vs 40: delta = -2, changeRate = -5%
        expect(evaluateCondition('changes_by_percent', 38, 40, 20, 'any').conditionMet).toBe(false);
      });
    });

    describe('direction: decrease', () => {
      it('returns true on drop exceeding threshold', () => {
        expect(evaluateCondition('changes_by_percent', 30, 40, 20, 'decrease').conditionMet).toBe(
          true
        );
      });

      it('returns false on increase (wrong direction)', () => {
        expect(evaluateCondition('changes_by_percent', 50, 40, 20, 'decrease').conditionMet).toBe(
          false
        );
      });
    });

    describe('direction: increase', () => {
      it('returns true on increase exceeding threshold', () => {
        expect(evaluateCondition('changes_by_percent', 50, 40, 20, 'increase').conditionMet).toBe(
          true
        );
      });

      it('returns false on drop (wrong direction)', () => {
        expect(evaluateCondition('changes_by_percent', 30, 40, 20, 'increase').conditionMet).toBe(
          false
        );
      });
    });

    it('returns false when previous value is zero (changeRate is null)', () => {
      const result = evaluateCondition('changes_by_percent', 30, 0, 20, 'any');
      expect(result.conditionMet).toBe(false);
      expect(result.changeRate).toBeNull();
    });
  });

  describe('changes_by_absolute', () => {
    it('returns false when previousValue is null', () => {
      expect(evaluateCondition('changes_by_absolute', 30, null, 5, 'any').conditionMet).toBe(false);
    });

    describe('direction: any', () => {
      it('returns true when absolute delta exceeds threshold', () => {
        // 30 vs 40: delta = -10, abs(delta) = 10 >= 5
        const result = evaluateCondition('changes_by_absolute', 30, 40, 5, 'any');
        expect(result.conditionMet).toBe(true);
        expect(result.delta).toBe(-10);
      });

      it('returns false when absolute delta is below threshold', () => {
        // 38 vs 40: delta = -2, abs(delta) = 2 < 5
        expect(evaluateCondition('changes_by_absolute', 38, 40, 5, 'any').conditionMet).toBe(false);
      });
    });

    describe('direction: decrease', () => {
      it('returns true on drop exceeding threshold', () => {
        expect(evaluateCondition('changes_by_absolute', 30, 40, 5, 'decrease').conditionMet).toBe(
          true
        );
      });

      it('returns false on increase (wrong direction)', () => {
        expect(evaluateCondition('changes_by_absolute', 50, 40, 5, 'decrease').conditionMet).toBe(
          false
        );
      });
    });

    describe('direction: increase', () => {
      it('returns true on increase exceeding threshold', () => {
        expect(evaluateCondition('changes_by_absolute', 50, 40, 5, 'increase').conditionMet).toBe(
          true
        );
      });

      it('returns false on drop (wrong direction)', () => {
        expect(evaluateCondition('changes_by_absolute', 30, 40, 5, 'increase').conditionMet).toBe(
          false
        );
      });
    });
  });
});

describe('isCooldownActive', () => {
  it('returns false when lastTriggeredAt is null (never triggered)', () => {
    expect(isCooldownActive(null, 60)).toBe(false);
  });

  it('returns true when within cooldown window', () => {
    const now = new Date('2026-04-03T12:00:00Z');
    const lastTriggered = new Date('2026-04-03T11:30:00Z'); // 30 min ago
    expect(isCooldownActive(lastTriggered, 60, now)).toBe(true);
  });

  it('returns false when cooldown has expired', () => {
    const now = new Date('2026-04-03T12:00:00Z');
    const lastTriggered = new Date('2026-04-03T10:30:00Z'); // 90 min ago
    expect(isCooldownActive(lastTriggered, 60, now)).toBe(false);
  });

  it('returns false at exact cooldown boundary (expired)', () => {
    const now = new Date('2026-04-03T12:00:00Z');
    const lastTriggered = new Date('2026-04-03T11:00:00Z'); // exactly 60 min ago
    expect(isCooldownActive(lastTriggered, 60, now)).toBe(false);
  });
});
