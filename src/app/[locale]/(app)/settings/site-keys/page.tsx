import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { SiteKeysSection } from '@/features/traffic/components/site-keys-section';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SiteKeysPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return <SiteKeysSection />;
}
