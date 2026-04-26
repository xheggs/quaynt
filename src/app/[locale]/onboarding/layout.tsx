import { Suspense } from 'react';
import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { SkipOnboardingButton } from '@/features/onboarding/components/skip-onboarding-button';
import { WizardProgress } from '@/features/onboarding/components/wizard-progress';
import { OnboardingMain } from '@/features/onboarding/components/onboarding-main';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function OnboardingLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'onboarding.wizard' });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <WizardProgress />
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Link href={`/${locale}`} aria-label="Quaynt" className="inline-flex items-center">
          <Logo width={96} height={24} />
        </Link>
        <div className="flex items-center gap-3">
          <SkipOnboardingButton label={t('skipOnboarding')} />
          <ThemeToggle />
        </div>
      </header>
      <OnboardingMain>
        <Suspense>{children}</Suspense>
      </OnboardingMain>
    </div>
  );
}
