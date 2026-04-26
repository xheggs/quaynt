import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { ReviewStep } from '@/features/onboarding/components/review-step';

type Props = {
  params: Promise<{ locale: string; jobId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'onboarding.review' });
  return { title: t('heroTitle') };
}

export default async function OnboardingReviewPage({ params }: Props) {
  const { locale, jobId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ReviewStep jobId={jobId} />;
}
