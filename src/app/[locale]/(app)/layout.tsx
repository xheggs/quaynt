import { Suspense } from 'react';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { AppShell } from '@/components/layout/app-shell';
import { getAuth } from '@/modules/auth/auth.config';
import { resolveWorkspace } from '@/modules/workspace/workspace.service';
import { getByWorkspace, recordVisit } from '@/modules/onboarding/onboarding.service';
import type { OnboardingStep } from '@/modules/onboarding/onboarding.schema';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

function stepToPath(step: OnboardingStep): string {
  switch (step) {
    case 'welcome':
      return 'welcome';
    case 'brand':
      return 'brand';
    case 'competitors':
      return 'competitors';
    case 'prompt_set':
    case 'first_run':
      return 'prompt-set';
    case 'done':
      return 'welcome';
  }
}

export default async function AppLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const requestHeaders = await headers();
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (session) {
    const ws = await resolveWorkspace(session.user.id);
    if (ws) {
      const state = await getByWorkspace(ws.id);
      if (!state.completedAt && !state.dismissedAt) {
        redirect(`/${locale}/onboarding/${stepToPath(state.step)}`);
      }

      // Telemetry-only: tracks last-seen timestamp + emits `second_session`
      // when the user returns after >1h. Failures are swallowed so a logging
      // hiccup never breaks the layout render.
      try {
        await recordVisit(ws.id, {
          sessionCreatedAt: session.session.createdAt,
          userId: session.user.id,
        });
      } catch {
        // intentionally ignored — telemetry must not break the page
      }
    }
  }

  return (
    <AppShell>
      <Suspense>{children}</Suspense>
    </AppShell>
  );
}
