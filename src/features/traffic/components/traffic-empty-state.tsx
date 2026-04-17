'use client';

import { Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { EmptyState } from '@/components/empty-state';

export function TrafficEmptyState() {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();

  return (
    <EmptyState
      variant="page"
      icon={Globe}
      title={t('empty.title')}
      description={t('empty.description')}
      action={{
        label: t('empty.action'),
        href: `/${locale}/settings/site-keys`,
      }}
    />
  );
}
