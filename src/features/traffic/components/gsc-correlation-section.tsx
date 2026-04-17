'use client';

import { useMemo } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import {
  useGscCorrelationSummaryQuery,
  useGscCorrelationTimeSeriesQuery,
  useGscTopQueriesQuery,
  useTriggerGscSyncMutation,
} from '../use-traffic-queries';
import { useGscConnectionsQuery } from '@/features/integrations/gsc/use-gsc-queries';
import type { GscCorrelationFilters } from '../traffic.api';
import { GscHonestyNotice } from './gsc-honesty-notice';
import { GscKpiCards } from './gsc-kpi-cards';
import { GscCorrelationChart } from './gsc-correlation-chart';
import { GscTopQueriesTable } from './gsc-top-queries-table';
import { GscConnectCta } from './gsc-connect-cta';

interface Props {
  filters: GscCorrelationFilters;
}

export function GscCorrelationSection({ filters }: Props) {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();
  const formatter = useFormatter();

  const connections = useGscConnectionsQuery();
  const activeConnections = useMemo(
    () => (connections.data?.connections ?? []).filter((c) => c.status !== 'revoked'),
    [connections.data]
  );
  const hasConnection = activeConnections.length > 0;

  const summary = useGscCorrelationSummaryQuery(filters);
  const timeSeries = useGscCorrelationTimeSeriesQuery(filters);
  const topQueries = useGscTopQueriesQuery(filters, 1, 25);
  const syncMutation = useTriggerGscSyncMutation();

  const firstConnection = activeConnections[0];
  const lastSyncLabel = firstConnection?.lastSyncAt
    ? t('gsc.lastSync', { time: formatter.dateTime(new Date(firstConnection.lastSyncAt), 'short') })
    : null;

  if (!hasConnection) {
    return (
      <section aria-labelledby="gsc-panel-heading" className="space-y-4" lang={locale}>
        <header>
          <h2 id="gsc-panel-heading" className="text-xl font-semibold">
            {t('gsc.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('gsc.description')}</p>
        </header>
        <GscHonestyNotice />
        <GscConnectCta />
      </section>
    );
  }

  return (
    <section aria-labelledby="gsc-panel-heading" className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="gsc-panel-heading" className="text-xl font-semibold">
            {t('gsc.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('gsc.description')}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastSyncLabel && <span className="text-xs text-muted-foreground">{lastSyncLabel}</span>}
          <Button
            size="sm"
            variant="outline"
            disabled={syncMutation.isPending}
            onClick={() => {
              if (firstConnection) syncMutation.mutate(firstConnection.id);
            }}
          >
            {syncMutation.isPending ? t('gsc.sync.inProgress') : t('gsc.sync.now')}
          </Button>
        </div>
      </header>

      <GscHonestyNotice />

      <GscKpiCards data={summary.data} loading={summary.isLoading} />

      <GscCorrelationChart data={timeSeries.data} loading={timeSeries.isLoading} />

      <GscTopQueriesTable data={topQueries.data?.data} loading={topQueries.isLoading} />
    </section>
  );
}
