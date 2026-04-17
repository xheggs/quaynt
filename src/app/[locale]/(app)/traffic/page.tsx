import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { TrafficView } from '@/features/traffic/components/traffic-view';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TrafficPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return <TrafficView />;
}
