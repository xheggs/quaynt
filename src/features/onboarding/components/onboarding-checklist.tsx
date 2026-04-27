'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useOnboarding, useUpdateOnboarding } from '@/features/onboarding';
import type { OnboardingResponse } from '@/features/onboarding';

type Item = {
  key: 'setup' | 'firstRun' | 'results';
  done: boolean;
  href: string;
};

function buildItems(state: OnboardingResponse, locale: string): Item[] {
  const setupDone =
    state.milestones.brandAdded &&
    state.milestones.competitorsAdded &&
    state.milestones.promptSetSelected;
  return [
    {
      key: 'setup',
      done: setupDone,
      href: `/${locale}/onboarding/welcome`,
    },
    {
      key: 'firstRun',
      done: state.milestones.firstRunTriggered,
      href: state.activeRunId
        ? `/${locale}/onboarding/first-run/${state.activeRunId}`
        : `/${locale}/onboarding/welcome`,
    },
    {
      key: 'results',
      done: state.milestones.resultsViewed,
      href: `/${locale}/dashboard`,
    },
  ];
}

export function OnboardingChecklist() {
  const t = useTranslations('onboarding.checklist');
  const locale = useLocale();
  const onboarding = useOnboarding();
  const update = useUpdateOnboarding();
  const wasIncompleteRef = useRef<boolean | null>(null);

  const state = onboarding.data;

  useEffect(() => {
    if (!state) return;
    const wasIncomplete = wasIncompleteRef.current;
    const isComplete = Boolean(state.completedAt);

    if (wasIncomplete === false && isComplete) {
      toast.success(t('celebration'));
    }

    wasIncompleteRef.current = isComplete;
  }, [state, t]);

  if (onboarding.isLoading || !state) return null;
  if (state.completedAt || state.dismissedAt) return null;

  const items = buildItems(state, locale);
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = (done / total) * 100;

  const handleDismiss = () => {
    update.mutate({ dismissedAt: new Date().toISOString() });
  };

  return (
    <Card aria-labelledby="onboarding-checklist-title">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle id="onboarding-checklist-title">{t('title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('summary', { done, total })}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            aria-label={t('dismiss')}
            disabled={update.isPending}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <Progress
          value={percent}
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('summary', { done, total })}
        />
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li
              key={item.key}
              className={cn(
                'flex items-center gap-3 py-3',
                item.done ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              <span
                className={cn(
                  'inline-flex size-5 shrink-0 items-center justify-center rounded-full border',
                  item.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                )}
                aria-hidden="true"
              >
                {item.done && <Check className="size-3" />}
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className={cn('text-sm font-medium', item.done && 'line-through')}>
                  {t(`items.${item.key}.label`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`items.${item.key}.description`)}
                </span>
              </div>
              {!item.done && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={item.href}>{t(`items.${item.key}.cta`)}</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
