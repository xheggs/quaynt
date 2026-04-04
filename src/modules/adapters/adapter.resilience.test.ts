// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryWithBackoff, CircuitBreaker, isTransientError } from './adapter.resilience';
import { TransientAdapterError, PermanentAdapterError } from './adapter.types';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error up to maxAttempts', async () => {
    vi.useRealTimers();
    const error = new TransientAdapterError('fail', 'test');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on permanent error', async () => {
    const error = new PermanentAdapterError('auth failed', 'test');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 10 })).rejects.toThrow(
      'auth failed'
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('succeeds after transient failures', async () => {
    vi.useRealTimers();
    const error = new TransientAdapterError('temp', 'test');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('recovered');

    const result = await retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('CircuitBreaker', () => {
  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('CLOSED');
  });

  it('stays CLOSED when calls succeed', async () => {
    const cb = new CircuitBreaker();
    await cb.execute(() => Promise.resolve('ok'));
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions to OPEN after error threshold is reached', async () => {
    const cb = new CircuitBreaker({ errorThresholdPercent: 50 });

    // 1 success, then 2 failures → 2/3 = 66% errors > 50% threshold
    await cb.execute(() => Promise.resolve('ok'));
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    expect(cb.getState()).toBe('OPEN');
  });

  it('rejects calls when OPEN', async () => {
    const cb = new CircuitBreaker({ errorThresholdPercent: 50 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(
      'Circuit breaker is open'
    );
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({
      errorThresholdPercent: 50,
      resetTimeoutMs: 1000,
    });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getState()).toBe('OPEN');

    vi.advanceTimersByTime(1001);
    expect(cb.getState()).toBe('HALF_OPEN');
    vi.useRealTimers();
  });

  it('returns to CLOSED after success in HALF_OPEN', async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({
      errorThresholdPercent: 50,
      resetTimeoutMs: 1000,
    });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    vi.advanceTimersByTime(1001);
    expect(cb.getState()).toBe('HALF_OPEN');

    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');
    vi.useRealTimers();
  });

  it('returns to OPEN after failure in HALF_OPEN', async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({
      errorThresholdPercent: 50,
      resetTimeoutMs: 1000,
    });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    vi.advanceTimersByTime(1001);
    await cb.execute(() => Promise.reject(new Error('still failing'))).catch(() => {});

    expect(cb.getState()).toBe('OPEN');
    vi.useRealTimers();
  });

  it('can be manually reset', async () => {
    const cb = new CircuitBreaker({ errorThresholdPercent: 50 });

    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
  });
});

describe('isTransientError', () => {
  it('classifies TransientAdapterError as transient', () => {
    expect(isTransientError(new TransientAdapterError('fail', 'test'))).toBe(true);
  });

  it('classifies PermanentAdapterError as not transient', () => {
    expect(isTransientError(new PermanentAdapterError('fail', 'test'))).toBe(false);
  });

  it('classifies network errors as transient', () => {
    expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
    expect(isTransientError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isTransientError(new Error('fetch failed'))).toBe(true);
  });

  it('classifies HTTP 429 as transient', () => {
    expect(isTransientError({ status: 429 })).toBe(true);
  });

  it('classifies HTTP 5xx as transient', () => {
    expect(isTransientError({ status: 500 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
  });

  it('classifies HTTP 4xx (non-429) as not transient', () => {
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError({ status: 404 })).toBe(false);
  });

  it('classifies unknown errors as not transient', () => {
    expect(isTransientError(new Error('something else'))).toBe(false);
    expect(isTransientError('string error')).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});
