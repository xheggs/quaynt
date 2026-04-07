// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolveSparklineGranularity, capSparklinePoints } from './report-data.utils';
import type { SparklinePoint } from './report-data.types';

describe('resolveSparklineGranularity', () => {
  it('returns day for 7-day range', () => {
    expect(resolveSparklineGranularity('2026-03-01', '2026-03-08')).toBe('day');
  });

  it('returns day for 30-day range', () => {
    expect(resolveSparklineGranularity('2026-03-01', '2026-03-31')).toBe('day');
  });

  it('returns day for 90-day range', () => {
    expect(resolveSparklineGranularity('2026-01-01', '2026-04-01')).toBe('day');
  });

  it('returns week for 91-day range', () => {
    expect(resolveSparklineGranularity('2026-01-01', '2026-04-02')).toBe('week');
  });

  it('returns week for 365-day range', () => {
    expect(resolveSparklineGranularity('2025-04-06', '2026-04-06')).toBe('week');
  });

  it('returns month for 366-day range', () => {
    expect(resolveSparklineGranularity('2025-04-05', '2026-04-06')).toBe('month');
  });
});

describe('capSparklinePoints', () => {
  function makePoints(count: number): SparklinePoint[] {
    return Array.from({ length: count }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      value: String(i * 10),
    }));
  }

  it('returns all points when fewer than maxPoints', () => {
    const points = makePoints(10);
    const result = capSparklinePoints(points, 30);
    expect(result).toHaveLength(10);
    expect(result).toEqual(points);
  });

  it('caps to maxPoints preserving first and last', () => {
    const points = makePoints(60);
    const result = capSparklinePoints(points, 30);
    expect(result).toHaveLength(30);
    expect(result[0]).toEqual(points[0]);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]);
  });
});
