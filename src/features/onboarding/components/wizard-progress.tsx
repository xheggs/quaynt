'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Progress } from '@/components/ui/progress';

type WizardStep =
  | { kind: 'auto'; key: 'domain' | 'confirm' | 'results'; value: 33 | 66 | 100 }
  | {
      kind: 'manual';
      key: 'brand' | 'competitors' | 'promptSet';
      value: 40 | 60 | 80;
    };

function deriveStep(pathname: string | null): WizardStep | null {
  if (!pathname) return null;
  // Strip locale prefix; match the trailing onboarding path.
  const match = pathname.match(/\/onboarding\/(.+)$/);
  if (!match) return null;
  const tail = match[1];
  if (tail.startsWith('welcome')) return { kind: 'auto', key: 'domain', value: 33 };
  if (tail.startsWith('review/')) return { kind: 'auto', key: 'confirm', value: 66 };
  if (tail.startsWith('first-run/')) return { kind: 'auto', key: 'results', value: 100 };
  if (tail.startsWith('brand')) return { kind: 'manual', key: 'brand', value: 40 };
  if (tail.startsWith('competitors')) return { kind: 'manual', key: 'competitors', value: 60 };
  if (tail.startsWith('prompt-set')) return { kind: 'manual', key: 'promptSet', value: 80 };
  return null;
}

export function WizardProgress() {
  const t = useTranslations('onboarding.wizard');
  const pathname = usePathname();
  const step = deriveStep(pathname);

  if (!step) return null;

  const label =
    step.kind === 'auto' ? t(`stepLabels.${step.key}`) : t(`stepLabels.manual.${step.key}`);

  const valuetext =
    step.kind === 'auto'
      ? t('progressLabel', { step: stepNumber(step.key), label })
      : t('manualProgressLabel', { label });

  return (
    <Progress
      value={step.value}
      className="h-0.5 rounded-none bg-transparent"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={step.value}
      aria-valuetext={valuetext}
      aria-label={valuetext}
    />
  );
}

function stepNumber(key: 'domain' | 'confirm' | 'results'): number {
  if (key === 'domain') return 1;
  if (key === 'confirm') return 2;
  return 3;
}
