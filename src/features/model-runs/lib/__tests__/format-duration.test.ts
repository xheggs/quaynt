import { describe, it, expect, vi } from 'vitest';
import { formatDuration } from '../format-duration';

// Mock translation function that returns the key with interpolated values
function mockT(key: string, values?: Record<string, unknown>): string {
  if (!values) return key;
  let result = key;
  for (const [k, v] of Object.entries(values)) {
    result += `:${k}=${v}`;
  }
  return result;
}

describe('formatDuration', () => {
  it('returns null when startedAt is null', () => {
    expect(formatDuration(null, '2026-01-15T00:05:00Z', mockT)).toBeNull();
  });

  it('returns null when completedAt is null', () => {
    expect(formatDuration('2026-01-15T00:00:00Z', null, mockT)).toBeNull();
  });

  it('returns null when both are null', () => {
    expect(formatDuration(null, null, mockT)).toBeNull();
  });

  it('returns subSecond key for durations under 1 second', () => {
    const result = formatDuration('2026-01-15T00:00:00.000Z', '2026-01-15T00:00:00.500Z', mockT);
    expect(result).toBe('duration.subSecond');
  });

  it('returns seconds key for short durations', () => {
    const result = formatDuration('2026-01-15T00:00:00Z', '2026-01-15T00:00:30Z', mockT);
    expect(result).toContain('duration.seconds');
    expect(result).toContain('value=30');
  });

  it('returns minutesSeconds key for medium durations', () => {
    const result = formatDuration('2026-01-15T00:00:00Z', '2026-01-15T00:02:15Z', mockT);
    expect(result).toContain('duration.minutesSeconds');
    expect(result).toContain('minutes=2');
    expect(result).toContain('seconds=15');
  });

  it('returns hoursMinutes key for long durations', () => {
    const result = formatDuration('2026-01-15T00:00:00Z', '2026-01-15T01:30:00Z', mockT);
    expect(result).toContain('duration.hoursMinutes');
    expect(result).toContain('hours=1');
    expect(result).toContain('minutes=30');
  });

  it('calls t function with correct keys', () => {
    const t = vi.fn().mockReturnValue('5m 30s');
    formatDuration('2026-01-15T00:00:00Z', '2026-01-15T00:05:30Z', t);
    expect(t).toHaveBeenCalledWith('duration.minutesSeconds', {
      minutes: 5,
      seconds: 30,
    });
  });
});
