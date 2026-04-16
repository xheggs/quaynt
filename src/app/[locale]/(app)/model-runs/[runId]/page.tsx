import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { ModelRunDetailView } from '@/features/model-runs/components/run-detail-view';

type Props = {
  params: Promise<{ locale: string; runId: string }>;
};

export default async function ModelRunDetailPage({ params }: Props) {
  const { locale, runId } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return <ModelRunDetailView runId={runId} />;
}
