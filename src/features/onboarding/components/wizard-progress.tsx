'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'connect' | 'confirm' | 'watch';

const PHASES: Phase[] = ['connect', 'confirm', 'watch'];

function derivePhase(pathname: string | null): Phase | null {
  if (!pathname) return null;
  const match = pathname.match(/\/onboarding\/(.+)$/);
  if (!match) return null;
  const tail = match[1];
  if (tail.startsWith('welcome')) return 'connect';
  if (tail.startsWith('review/')) return 'confirm';
  if (tail.startsWith('first-run/')) return 'watch';
  return null;
}

export function WizardProgress() {
  const t = useTranslations('onboarding.wizard');
  const pathname = usePathname();
  const phase = derivePhase(pathname);

  if (!phase) return null;

  const activeIndex = PHASES.indexOf(phase);

  const ariaLabel = t('progressLabel', {
    step: activeIndex + 1,
    label: t(`phaseLabels.${phase}`),
  });

  return (
    <nav aria-label={ariaLabel}>
      <ol className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pb-2 pt-1 sm:gap-3 sm:px-10">
        {PHASES.map((p, index) => {
          const status: 'complete' | 'active' | 'pending' =
            index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'pending';
          const phaseLabel = t(`phaseLabels.${p}`);
          return (
            <li
              key={p}
              className={cn(
                'flex flex-1 items-center gap-2 sm:gap-3',
                index < PHASES.length - 1 && 'after:hidden sm:after:block'
              )}
              aria-current={status === 'active' ? 'step' : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors',
                  status === 'complete' && 'border-primary bg-primary text-primary-foreground',
                  status === 'active' && 'border-primary text-primary',
                  status === 'pending' && 'border-border text-muted-foreground'
                )}
              >
                {status === 'complete' ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'truncate text-xs font-medium uppercase tracking-[0.08em] sm:text-[11px]',
                  status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {phaseLabel}
              </span>
              {index < PHASES.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-1 hidden h-px flex-1 sm:block',
                    index < activeIndex ? 'bg-primary' : 'bg-border'
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
