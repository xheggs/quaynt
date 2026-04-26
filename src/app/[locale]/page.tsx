import { hasLocale } from 'next-intl';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { routing } from '@/lib/i18n/routing';
import { getAuth } from '@/modules/auth/auth.config';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect(`/${locale}/dashboard`);
  }
  redirect(`/${locale}/sign-in`);
}
