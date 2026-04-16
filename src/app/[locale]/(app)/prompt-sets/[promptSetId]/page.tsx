import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { PromptSetDetailView } from '@/features/prompt-sets/components/prompt-set-detail-view';

type Props = {
  params: Promise<{ locale: string; promptSetId: string }>;
};

export default async function PromptSetDetailPage({ params }: Props) {
  const { locale, promptSetId } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return <PromptSetDetailView promptSetId={promptSetId} />;
}
