'use client';

import { useEffect, useRef, useState } from 'react';

interface UseDelayedLoadingOptions {
  /** Delay before showing skeleton (ms). Default: 150 */
  delay?: number;
  /** Minimum display time once shown (ms). Default: 300 */
  minDisplay?: number;
}

/**
 * Prevents skeleton flicker on fast loads.
 *
 * - If loading completes within `delay` ms, skeleton is never shown.
 * - Once shown, skeleton stays visible for at least `minDisplay` ms.
 */
export function useDelayedLoading(
  isLoading: boolean,
  options?: UseDelayedLoadingOptions
): { showSkeleton: boolean } {
  const delay = options?.delay ?? 150;
  const minDisplay = options?.minDisplay ?? 300;

  const [showSkeleton, setShowSkeleton] = useState(false);
  const delayTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const minDisplayTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shownAt = useRef<number>(0);

  useEffect(() => {
    if (isLoading) {
      delayTimer.current = setTimeout(() => {
        shownAt.current = Date.now();
        setShowSkeleton(true);
      }, delay);
    } else {
      clearTimeout(delayTimer.current);

      if (showSkeleton) {
        const elapsed = Date.now() - shownAt.current;
        const remaining = Math.max(0, minDisplay - elapsed);

        // Always use setTimeout to hide — avoids synchronous setState in effect
        minDisplayTimer.current = setTimeout(() => {
          setShowSkeleton(false);
        }, remaining);
      }
    }

    return () => {
      clearTimeout(delayTimer.current);
      clearTimeout(minDisplayTimer.current);
    };
  }, [isLoading, delay, minDisplay, showSkeleton]);

  return { showSkeleton };
}
