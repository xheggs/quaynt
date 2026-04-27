'use client';

import type { ReactNode } from 'react';

export type OnboardingPhase = 'connect' | 'confirm' | 'watch';

interface Props {
  /** Currently unused — kept for callsite clarity and forward-compat. */
  phase: OnboardingPhase;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Optional sub-line shown under the title — used by First Run for live progress copy. */
  secondary?: ReactNode;
}

export function OnboardingPageHeader({ title, subtitle, trailing, secondary }: Props) {
  return (
    <header className="flex animate-in flex-col gap-3 fade-in slide-in-from-bottom-1 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="type-display max-w-3xl text-balance text-foreground">{title}</h1>
        {trailing ? <div className="shrink-0 pt-1">{trailing}</div> : null}
      </div>
      {subtitle ? <p className="max-w-prose text-base text-muted-foreground">{subtitle}</p> : null}
      {secondary ? <div className="text-xs text-muted-foreground">{secondary}</div> : null}
    </header>
  );
}
