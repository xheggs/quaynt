import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { BrandDetailView } from '@/features/brands/components/brand-detail-view';

type Props = {
  params: Promise<{ locale: string; brandId: string }>;
};

export default async function BrandDetailPage({ params }: Props) {
  const { locale, brandId } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return <BrandDetailView brandId={brandId} />;
}
