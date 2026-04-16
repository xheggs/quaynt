import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { CitationDetailView } from '@/features/citations/components/citation-detail-view';

type Props = {
  params: Promise<{ locale: string; citationId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: 'citations' });
  return { title: t('detail.pageTitle') };
}

export default async function CitationDetailPage({ params }: Props) {
  const { locale, citationId } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return <CitationDetailView citationId={citationId} />;
}
