'use client';

import { usePathname } from 'next/navigation';

type Step = 'domain' | 'confirm' | 'results' | 'manual' | null;

function deriveStep(pathname: string | null): Step {
  if (!pathname) return null;
  const match = pathname.match(/\/onboarding\/(.+)$/);
  if (!match) return null;
  const tail = match[1];
  if (tail.startsWith('welcome')) return 'domain';
  if (tail.startsWith('review/')) return 'confirm';
  if (tail.startsWith('first-run/')) return 'results';
  if (tail.startsWith('brand') || tail.startsWith('competitors') || tail.startsWith('prompt-set')) {
    return 'manual';
  }
  return null;
}

export function OnboardingMain({ children }: { children: React.ReactNode }) {
  const step = deriveStep(usePathname());
  return (
    <main
      id="main-content"
      data-step={step ?? 'unknown'}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-16 pt-6 sm:px-10 data-[step=domain]:max-w-xl data-[step=confirm]:max-w-3xl data-[step=results]:max-w-3xl"
    >
      {children}
    </main>
  );
}
