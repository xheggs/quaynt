import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { DualScorePageClient } from './dual-score-page-client';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ brandId?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: 'dualScore' });
  return { title: t('page.title') };
}

export default async function DualScorePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const { brandId } = await searchParams;

  return <DualScorePageClient brandId={brandId} />;
}
