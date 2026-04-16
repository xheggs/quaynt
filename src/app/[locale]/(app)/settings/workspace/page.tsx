import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { WorkspaceSettingsView } from '@/features/settings/components/workspace-settings-view';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function WorkspaceSettingsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return <WorkspaceSettingsView />;
}
