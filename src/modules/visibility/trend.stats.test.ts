// @vitest-environment node
import { describe, it, expect } from 'vitest';

import {
  computeDelta,
  computeEWMA,
  computeOverallDirection,
  computeSpearmanRho,
  computeControlLimits,
  detectAnomaly,
  computeSignificance,
  computeCredibleInterval,
} from './trend.stats';

describe('computeDelta', () => {
  it('returns positive delta and up direction for increasing values', () => {
    const result = computeDelta(50, 40);
    expect(result.delta).toBe(10);
    expect(result.changeRate).toBeCloseTo(25.0);
    expect(result.direction).toBe('up');
  });

  it('returns zero delta and stable direction for equal values', () => {
    const result = computeDelta(35, 35);
    expect(result.delta).toBe(0);
    expect(result.changeRate).toBe(0);
    expect(result.direction).toBe('stable');
  });

  it('returns negative delta and down direction for decreasing values', () => {
    const result = computeDelta(30, 40);
    expect(result.delta).toBe(-10);
    expect(result.changeRate).toBeCloseTo(-25.0);
    expect(result.direction).toBe('down');
  });

  it('returns null changeRate when previous is zero', () => {
    const result = computeDelta(10, 0);
    expect(result.delta).toBe(10);
    expect(result.changeRate).toBeNull();
    expect(result.direction).toBe('up');
  });
});

describe('computeEWMA', () => {
  it('returns the value itself for single-element array', () => {
    expect(computeEWMA([42])).toEqual([42]);
  });

  it('returns empty array for empty input', () => {
    expect(computeEWMA([])).toEqual([]);
  });

  it('returns approximately constant values for constant input', () => {
    const result = computeEWMA([10, 10, 10, 10]);
    for (const v of result) {
      expect(v).toBeCloseTo(10, 5);
    }
  });

  it('EWMA lags behind increasing values but trends up', () => {
    const values = [10, 20, 30, 40, 50];
    const result = computeEWMA(values);

    // EWMA values should be less than or equal to the raw value (lagging)
    for (let i = 1; i < values.length; i++) {
      expect(result[i]).toBeLessThanOrEqual(values[i]);
    }

    // EWMA should be monotonically non-decreasing and overall increasing
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(result[i - 1]);
    }
    expect(result[result.length - 1]).toBeGreaterThan(result[0]);
  });

  it('smoothly transitions on step change', () => {
    const values = [10, 10, 10, 50, 50, 50];
    const result = computeEWMA(values);

    // Before step: should be near 10
    expect(result[2]).toBeCloseTo(10, 0);

    // Right after step: should be between 10 and 50
    expect(result[3]).toBeGreaterThan(10);
    expect(result[3]).toBeLessThan(50);

    // At end: should be closer to 50 than to 10
    expect(result[5]).toBeGreaterThan(30);
  });

  it('higher alpha tracks changes faster', () => {
    const values = [10, 10, 10, 50, 50, 50];
    const slowEWMA = computeEWMA(values, 0.1);
    const fastEWMA = computeEWMA(values, 0.5);

    // After step change, fast alpha should be closer to 50
    expect(fastEWMA[4]).toBeGreaterThan(slowEWMA[4]);
  });

  it('seeds with SMA of first 3 points', () => {
    const values = [10, 20, 30, 40];
    const result = computeEWMA(values);
    // First value is SMA of [10, 20, 30] = 20
    expect(result[0]).toBeCloseTo(20, 5);
  });

  it('seeds with single value when only 2 elements', () => {
    const values = [10, 20];
    const result = computeEWMA(values);
    // Seed = SMA of [10, 20] = 15
    expect(result[0]).toBeCloseTo(15, 5);
    // Second = 0.3 * 20 + 0.7 * 15 = 6 + 10.5 = 16.5
    expect(result[1]).toBeCloseTo(16.5, 5);
  });
});

describe('computeOverallDirection', () => {
  it('returns up when last > first', () => {
    expect(computeOverallDirection(10, 20)).toBe('up');
  });

  it('returns down when last < first', () => {
    expect(computeOverallDirection(20, 10)).toBe('down');
  });

  it('returns stable when equal', () => {
    expect(computeOverallDirection(15, 15)).toBe('stable');
  });
});

describe('computeControlLimits', () => {
  it('returns Infinity for single-value EWMA', () => {
    const result = computeControlLimits([42]);
    expect(result.upper).toEqual([Infinity]);
    expect(result.lower).toEqual([-Infinity]);
  });

  it('returns tight limits for stable data', () => {
    const stableEWMA = [10, 10.1, 10.05, 10.08, 10.02, 10.06];
    const result = computeControlLimits(stableEWMA);

    // Limits should exist for points with enough history
    for (let i = 2; i < stableEWMA.length; i++) {
      expect(result.upper[i]).toBeGreaterThan(stableEWMA[i]);
      expect(result.lower[i]).toBeLessThan(stableEWMA[i]);
      // Tight: within ~1 of the value
      expect(result.upper[i] - result.lower[i]).toBeLessThan(2);
    }
  });

  it('returns wider limits for volatile data', () => {
    const volatileEWMA = [10, 15, 8, 20, 5, 18];
    const result = computeControlLimits(volatileEWMA);

    // At later points, limits should be wider than for stable data
    const stableResult = computeControlLimits([10, 10.1, 10.05, 10.08, 10.02, 10.06]);
    const volatileRange = result.upper[5] - result.lower[5];
    const stableRange = stableResult.upper[5] - stableResult.lower[5];
    expect(volatileRange).toBeGreaterThan(stableRange);
  });

  it('first two points have Infinity limits', () => {
    const result = computeControlLimits([10, 20, 30, 40]);
    expect(result.upper[0]).toBe(Infinity);
    expect(result.lower[0]).toBe(-Infinity);
    expect(result.upper[1]).toBe(Infinity);
    expect(result.lower[1]).toBe(-Infinity);
  });
});

describe('detectAnomaly', () => {
  it('detects anomaly above upper limit', () => {
    const result = detectAnomaly(100, 50, 80, 20);
    expect(result.isAnomaly).toBe(true);
    expect(result.direction).toBe('above');
  });

  it('detects anomaly below lower limit', () => {
    const result = detectAnomaly(5, 50, 80, 20);
    expect(result.isAnomaly).toBe(true);
    expect(result.direction).toBe('below');
  });

  it('returns no anomaly for value within limits', () => {
    const result = detectAnomaly(50, 50, 80, 20);
    expect(result.isAnomaly).toBe(false);
    expect(result.direction).toBeNull();
  });

  it('returns no anomaly for value exactly at limits', () => {
    expect(detectAnomaly(80, 50, 80, 20).isAnomaly).toBe(false);
    expect(detectAnomaly(20, 50, 80, 20).isAnomaly).toBe(false);
  });
});

describe('computeSignificance', () => {
  it('detects significance for large change with large sample', () => {
    // 60/200 vs 40/200 — substantial difference with decent sample
    const result = computeSignificance(60, 200, 40, 200);
    expect(result.isSignificant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it('does not detect significance for small change with small sample', () => {
    // 6/20 vs 5/20 — tiny difference with small sample
    const result = computeSignificance(6, 20, 5, 20);
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBeGreaterThan(0.05);
  });

  it('returns not significant for no change', () => {
    const result = computeSignificance(50, 100, 50, 100);
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBe(1);
  });

  it('handles zero totals gracefully', () => {
    const result = computeSignificance(0, 0, 5, 10);
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBe(1);
  });

  it('handles zero counts', () => {
    const result = computeSignificance(0, 100, 0, 100);
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBe(1);
  });
});

describe('computeCredibleInterval', () => {
  it('centers near 0.5 for 50/100', () => {
    const result = computeCredibleInterval(50, 100);
    expect(result.lower).toBeGreaterThan(0.35);
    expect(result.lower).toBeLessThan(0.5);
    expect(result.upper).toBeGreaterThan(0.5);
    expect(result.upper).toBeLessThan(0.65);
  });

  it('centers near 0 for 1/100', () => {
    const result = computeCredibleInterval(1, 100);
    expect(result.lower).toBeGreaterThanOrEqual(0);
    expect(result.lower).toBeLessThan(0.01);
    expect(result.upper).toBeLessThan(0.1);
  });

  it('produces wider interval with smaller sample', () => {
    const small = computeCredibleInterval(5, 10);
    const large = computeCredibleInterval(50, 100);
    expect(small.upper - small.lower).toBeGreaterThan(large.upper - large.lower);
  });

  it('returns wider interval for higher confidence', () => {
    const narrow = computeCredibleInterval(50, 100, 0.9);
    const wide = computeCredibleInterval(50, 100, 0.99);
    expect(wide.upper - wide.lower).toBeGreaterThan(narrow.upper - narrow.lower);
  });

  it('bounds results between 0 and 1', () => {
    const result = computeCredibleInterval(0, 100);
    expect(result.lower).toBeGreaterThanOrEqual(0);
    expect(result.upper).toBeLessThanOrEqual(1);
  });

  it('handles zero total gracefully', () => {
    const result = computeCredibleInterval(0, 0);
    expect(result.lower).toBe(0);
    expect(result.upper).toBe(1);
  });
});

describe('computeSpearmanRho', () => {
  it('returns rho=1 for a perfectly positive monotonic relationship', () => {
    const pairs: Array<[number, number]> = [
      [1, 10],
      [2, 20],
      [3, 30],
      [4, 45],
      [5, 80],
    ];
    const result = computeSpearmanRho(pairs);
    expect(result.n).toBe(5);
    expect(result.rho).toBeCloseTo(1, 12);
  });

  it('returns rho=-1 for a perfectly negative monotonic relationship', () => {
    const pairs: Array<[number, number]> = [
      [1, 100],
      [2, 80],
      [3, 60],
      [4, 40],
      [5, 20],
    ];
    const result = computeSpearmanRho(pairs);
    expect(result.n).toBe(5);
    expect(result.rho).toBeCloseTo(-1, 12);
  });

  it('handles ties using average ranks', () => {
    // x has a tie at 2; y has a tie at 20.
    // Ranks of x: [1, 2.5, 2.5, 4]; ranks of y: [4, 2.5, 2.5, 1].
    const pairs: Array<[number, number]> = [
      [1, 40],
      [2, 20],
      [2, 20],
      [4, 10],
    ];
    const result = computeSpearmanRho(pairs);
    expect(result.n).toBe(4);
    expect(result.rho).toBeCloseTo(-1, 12);
  });

  it('returns rho near zero for unrelated data', () => {
    const pairs: Array<[number, number]> = [
      [1, 5],
      [2, 3],
      [3, 4],
      [4, 2],
      [5, 6],
      [6, 1],
    ];
    const result = computeSpearmanRho(pairs);
    expect(result.n).toBe(6);
    expect(Math.abs(result.rho ?? 1)).toBeLessThan(0.5);
  });

  it('returns { rho: null, n: 0 } for empty input', () => {
    expect(computeSpearmanRho([])).toEqual({ rho: null, n: 0 });
  });

  it('returns { rho: null, n } when all x values are identical', () => {
    const pairs: Array<[number, number]> = [
      [3, 1],
      [3, 2],
      [3, 3],
    ];
    const result = computeSpearmanRho(pairs);
    expect(result.n).toBe(3);
    expect(result.rho).toBeNull();
  });

  it('returns { rho: null, n } when all y values are identical', () => {
    const pairs: Array<[number, number]> = [
      [1, 7],
      [2, 7],
      [3, 7],
    ];
    const result = computeSpearmanRho(pairs);
    expect(result.n).toBe(3);
    expect(result.rho).toBeNull();
  });

  it('drops pairs containing non-finite numbers', () => {
    const pairs: Array<[number, number]> = [
      [1, 10],
      [2, Number.NaN],
      [3, 30],
      [Number.POSITIVE_INFINITY, 40],
    ];
    const result = computeSpearmanRho(pairs);
    expect(result.n).toBe(2);
    expect(result.rho).toBeCloseTo(1, 12);
  });

  it('handles a single-pair input as undefined correlation', () => {
    const result = computeSpearmanRho([[1, 2]]);
    expect(result.n).toBe(1);
    expect(result.rho).toBeNull();
  });
});
