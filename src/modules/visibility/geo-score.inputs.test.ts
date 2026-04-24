// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import {
  rollupWeightedRatio,
  rollupSum,
  rollupUnion,
  coefficientOfVariation,
  currentPeriod,
  lastCompletePeriod,
  isPeriodAligned,
} from './geo-score.inputs';

describe('rollupWeightedRatio', () => {
  it('returns weighted average', () => {
    expect(
      rollupWeightedRatio([
        { value: 10, weight: 2 },
        { value: 20, weight: 3 },
      ])
    ).toBeCloseTo((10 * 2 + 20 * 3) / (2 + 3));
  });

  it('ignores samples with zero weight', () => {
    expect(
      rollupWeightedRatio([
        { value: 100, weight: 0 },
        { value: 50, weight: 10 },
      ])
    ).toBe(50);
  });

  it('ignores null values', () => {
    expect(
      rollupWeightedRatio([
        { value: null, weight: 100 },
        { value: 5, weight: 5 },
      ])
    ).toBe(5);
  });

  it('returns null when total weight is 0', () => {
    expect(rollupWeightedRatio([{ value: 100, weight: 0 }])).toBeNull();
    expect(rollupWeightedRatio([])).toBeNull();
  });
});

describe('rollupSum', () => {
  it('sums values', () => {
    expect(rollupSum([1, 2, 3])).toBe(6);
    expect(rollupSum([])).toBe(0);
  });
});

describe('rollupUnion', () => {
  it('deduplicates across sets', () => {
    expect(
      rollupUnion([
        ['a', 'b'],
        ['b', 'c'],
      ]).sort()
    ).toEqual(['a', 'b', 'c']);
  });

  it('handles empty sets', () => {
    expect(rollupUnion([])).toEqual([]);
    expect(rollupUnion([[]])).toEqual([]);
  });
});

describe('coefficientOfVariation', () => {
  it('returns 0 for identical values', () => {
    expect(coefficientOfVariation([5, 5, 5])).toBe(0);
  });

  it('returns null for empty input', () => {
    expect(coefficientOfVariation([])).toBeNull();
  });

  it('returns null when mean is 0', () => {
    expect(coefficientOfVariation([0, 0, 0])).toBeNull();
  });

  it('returns > 0 for varying values', () => {
    const cv = coefficientOfVariation([1, 2, 3, 4]);
    expect(cv).toBeGreaterThan(0);
  });
});

describe('currentPeriod', () => {
  it('returns the ISO week containing `at` (Monday start) for weekly', () => {
    // 2026-04-24 is a Friday
    const r = currentPeriod(new Date('2026-04-24T00:00:00Z'), 'weekly');
    expect(r.periodStart).toBe('2026-04-20'); // Monday
    expect(r.periodEnd).toBe('2026-04-26'); // Sunday
  });

  it('returns the month for monthly', () => {
    const r = currentPeriod(new Date('2026-04-24T00:00:00Z'), 'monthly');
    expect(r.periodStart).toBe('2026-04-01');
    expect(r.periodEnd).toBe('2026-04-30');
  });
});

describe('lastCompletePeriod', () => {
  it('returns previous week for weekly', () => {
    const r = lastCompletePeriod(new Date('2026-04-24T00:00:00Z'), 'weekly');
    expect(r.periodStart).toBe('2026-04-13');
    expect(r.periodEnd).toBe('2026-04-19');
  });

  it('returns previous month for monthly', () => {
    const r = lastCompletePeriod(new Date('2026-04-24T00:00:00Z'), 'monthly');
    expect(r.periodStart).toBe('2026-03-01');
    expect(r.periodEnd).toBe('2026-03-31');
  });
});

describe('isPeriodAligned', () => {
  it('detects Monday for weekly', () => {
    expect(isPeriodAligned('2026-04-20', 'weekly')).toBe(true); // Monday
    expect(isPeriodAligned('2026-04-21', 'weekly')).toBe(false);
  });

  it('detects first of month for monthly', () => {
    expect(isPeriodAligned('2026-04-01', 'monthly')).toBe(true);
    expect(isPeriodAligned('2026-04-02', 'monthly')).toBe(false);
  });
});
