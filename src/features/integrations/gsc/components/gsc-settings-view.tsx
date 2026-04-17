'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';

import { ErrorBoundary } from '@/components/error-boundary';

import { GscConnectionsList } from './gsc-connections-list';
import { ConnectGscPropertyDialog } from './connect-gsc-property-dialog';

export function GscSettingsView() {
  const t = useTranslations('integrations');

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t('gsc.title')}</h1>
            <p className="text-muted-foreground">{t('gsc.description')}</p>
          </div>
          <Suspense fallback={null}>
            <ConnectGscPropertyDialog />
          </Suspense>
        </header>

        <GscConnectionsList />
      </div>
    </ErrorBoundary>
  );
}
