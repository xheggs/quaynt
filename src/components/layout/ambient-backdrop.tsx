'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Reusable wrapper combining the dot-grid backdrop with a cursor-following
 * masked glow. Generalised from the sign-in `BrandPanel` so that other
 * surfaces (dashboards, marketing bands, etc.) can adopt the same ambient
 * treatment without re-implementing the rAF-throttled pointer plumbing.
 */
export type AmbientBackdropProps = {
  children: ReactNode;
  className?: string;
  /**
   * `panel` = 22px dot grid (default, matches sign-in).
   * `band` = 16px tighter dots, intended for narrow hero bands.
   */
  density?: 'panel' | 'band';
  /** Glow radius CSS length. Defaults: panel `220px`, band `320px`. */
  glowRadius?: string;
  /** When true (default), the glow fades to 0 on pointer leave. */
  idleHidden?: boolean;
  /** When true, suppress the interactive glow layer entirely (pure dot-grid). */
  staticOnly?: boolean;
};

type CSSVarStyle = CSSProperties & Record<`--${string}`, string>;

export function AmbientBackdrop({
  children,
  className,
  density = 'panel',
  glowRadius,
  idleHidden = true,
  staticOnly = false,
}: AmbientBackdropProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (staticOnly) return;
      const el = wrapRef.current;
      if (!el) return;
      if (rafRef.current !== null) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${clientX - rect.left}px`);
        el.style.setProperty('--my', `${clientY - rect.top}px`);
        el.dataset.idle = 'false';
      });
    },
    [staticOnly]
  );

  const handleLeave = useCallback(() => {
    if (staticOnly) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (idleHidden && wrapRef.current) {
      wrapRef.current.dataset.idle = 'true';
    }
  }, [idleHidden, staticOnly]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const resolvedGlow = glowRadius ?? (density === 'band' ? '320px' : '220px');
  const style: CSSVarStyle = { '--glow-r': resolvedGlow };

  const dotGridClass = density === 'band' ? 'dot-grid-band' : 'dot-grid';

  return (
    <div
      ref={wrapRef}
      data-idle="true"
      data-density={density}
      style={style}
      onPointerMove={staticOnly ? undefined : handleMove}
      onPointerLeave={staticOnly ? undefined : handleLeave}
      className={cn(dotGridClass, 'dot-grid-wrap', 'relative', className)}
    >
      {!staticOnly && <div aria-hidden="true" className="dot-grid-glow" />}
      <div className="relative">{children}</div>
    </div>
  );
}
