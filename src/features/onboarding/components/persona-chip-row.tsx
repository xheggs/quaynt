'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ONBOARDING_ROLE_HINTS, type OnboardingRoleHint } from '@/features/onboarding/types';
import { useUpdateOnboarding } from '@/features/onboarding/hooks/use-onboarding';

type Props = {
  currentRole: OnboardingRoleHint | null;
};

export function PersonaChipRow({ currentRole }: Props) {
  const t = useTranslations('onboarding.persona');
  const tErrors = useTranslations('onboarding.errors');
  const update = useUpdateOnboarding();

  // Optimistic local state — flips immediately on click before the PATCH resolves.
  // Server is the source of truth on success/error.
  const [optimisticRole, setOptimisticRole] = useState<OnboardingRoleHint | null>(currentRole);

  function handleSelect(role: OnboardingRoleHint) {
    const previous = optimisticRole;
    setOptimisticRole(role);
    update.mutate(
      { roleHint: role },
      {
        onError: () => {
          setOptimisticRole(previous);
          toast.error(tErrors('generic'));
        },
      }
    );
  }

  return (
    <section
      aria-labelledby="persona-chip-heading"
      className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/20 p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="persona-chip-heading" className="text-sm font-medium">
          {t('title')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="persona-chip-heading"
        className="flex flex-wrap gap-2"
      >
        {ONBOARDING_ROLE_HINTS.map((role) => {
          const checked = optimisticRole === role;
          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => handleSelect(role)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                checked
                  ? 'border-primary bg-primary/10 font-medium text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40'
              )}
            >
              {t(`roles.${role}`)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
