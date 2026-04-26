import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { getAuth } from '@/modules/auth/auth.config';
import { resolveWorkspace } from '@/modules/workspace/workspace.service';
import { getModelRun } from '@/modules/model-runs/model-run.service';
import { FirstRunProgress } from '@/features/onboarding/components/first-run-progress';

type Props = {
  params: Promise<{ locale: string; runId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: 'onboarding.firstRun' });
  return { title: t('title') };
}

export default async function FirstRunPage({ params }: Props) {
  const { locale, runId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const requestHeaders = await headers();
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const workspace = await resolveWorkspace(session.user.id);
  if (!workspace) {
    notFound();
  }

  // Server-side ownership pre-check: any unknown or foreign runId yields a
  // clean 404 instead of a half-rendered client view that polls and errors.
  const run = await getModelRun(runId, workspace.id);
  if (!run) {
    notFound();
  }

  return <FirstRunProgress runId={runId} />;
}
