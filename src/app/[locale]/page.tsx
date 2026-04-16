import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="flex max-w-lg flex-col items-center gap-8 text-center">
        {/* Brand mark */}
        <div className="flex size-16 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="size-8"
          >
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="type-display text-foreground">{t('common.appName')}</h1>
          <p className="text-lg text-muted-foreground">{t('common.appDescription')}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button asChild size="lg">
            <Link href={`/${locale}/sign-in`}>{t('common.getStarted')}</Link>
          </Button>
          <Button variant="outline" size="lg">
            {t('common.learnMore')}
          </Button>
        </div>
      </div>
    </main>
  );
}
