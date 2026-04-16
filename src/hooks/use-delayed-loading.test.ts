import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedLoading } from './use-delayed-loading';

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show skeleton for fast loads (< 150ms)', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: true },
    });

    expect(result.current.showSkeleton).toBe(false);

    // Loading finishes before delay
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ isLoading: false });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.showSkeleton).toBe(false);
  });

  it('shows skeleton after 150ms delay', () => {
    const { result } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: true },
    });

    expect(result.current.showSkeleton).toBe(false);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.showSkeleton).toBe(true);
  });

  it('keeps skeleton visible for minimum 300ms', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading), {
      initialProps: { isLoading: true },
    });

    // Show skeleton
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.showSkeleton).toBe(true);

    // Loading finishes after 200ms total (50ms after skeleton shown)
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ isLoading: false });

    // Skeleton should still show (min 300ms not reached)
    expect(result.current.showSkeleton).toBe(true);

    // Advance to complete minimum display
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.showSkeleton).toBe(false);
  });
});
