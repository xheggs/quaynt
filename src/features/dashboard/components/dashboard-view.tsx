'use client';

import { BarChart3 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';

import { EmptyState } from '@/components/empty-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { ErrorState } from '@/components/error-state';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';

import type { DashboardFilters } from '../dashboard.types';
import { useDashboardQuery, usePromptSetOptions } from '../use-dashboard-query';
import { AlertsSection } from './alerts-section';
import { DashboardFilterBar } from './dashboard-filters';
import { DashboardSkeleton } from './dashboard-skeleton';
import { KpiCard } from './kpi-card';
import { MoversSection } from './movers-section';
import { OpportunitiesSection } from './opportunities-section';
import { PlatformsSection } from './platforms-section';

export function DashboardView() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}

const filterParsers = {
  promptSetId: parseAsString,
  from: parseAsString,
  to: parseAsString,
};

function DashboardContent() {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const [params, setParams] = useQueryStates(filterParsers, { shallow: false });
  const filters: DashboardFilters = {
    promptSetId: params.promptSetId ?? undefined,
    from: params.from ?? undefined,
    to: params.to ?? undefined,
  };

  const { data, isLoading, isError, refetch } = useDashboardQuery(filters);
  const { options: promptSetOptions, isLoading: promptSetLoading } = usePromptSetOptions();
  const { showSkeleton } = useDelayedLoading(isLoading);

  const handleFiltersChange = (next: DashboardFilters) => {
    setParams({
      promptSetId: next.promptSetId ?? null,
      from: next.from ?? null,
      to: next.to ?? null,
    });
  };

  if (showSkeleton) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState variant="page" onRetry={refetch} />
      </div>
    );
  }

  if (!data) return null;

  // Empty workspace: all sections empty/null AND no warnings
  const isEmptyWorkspace =
    data.period.from === data.period.to &&
    !data.kpis &&
    (!data.movers || data.movers.length === 0) &&
    (!data.opportunities || data.opportunities.length === 0) &&
    (!data.platforms || data.platforms.length === 0) &&
    (!data.alerts || (data.alerts.total === 0 && data.alerts.recentEvents.length === 0)) &&
    (!data.warnings || data.warnings.length === 0);

  if (isEmptyWorkspace) {
    return (
      <div className="space-y-8">
        <h1 className="type-page">{t('header.title')}</h1>
        <EmptyState
          variant="page"
          icon={BarChart3}
          title={t('empty.title')}
          description={t('empty.description')}
          action={{
            label: t('empty.cta'),
            href: `/${locale}/brands`,
          }}
        />
      </div>
    );
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="type-page">{t('header.title')}</h1>
      </div>

      {/* Filters + data freshness */}
      <div className="space-y-2">
        <DashboardFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          promptSetOptions={promptSetOptions}
          promptSetLoading={promptSetLoading}
        />
        <p className="type-caption text-muted-foreground">
          {t('dataAsOf', { date: dateFormatter.format(new Date(data.dataAsOf)) })}
        </p>
      </div>

      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="space-y-1">
          {data.warnings.map((warning, i) => (
            <div key={i} className="rounded-md bg-warning-bg px-3 py-2">
              <p className="type-caption text-warning">{warning}</p>
            </div>
          ))}
        </div>
      )}

      {/* KPI row */}
      {data.kpis && (
        <div className="grid grid-cols-12 gap-4">
          <KpiCard
            className="col-span-12 md:col-span-6 lg:col-span-4"
            label={t('kpiCards.recommendationShare')}
            value={data.kpis.recommendationShare.current}
            delta={data.kpis.recommendationShare.delta}
            direction={data.kpis.recommendationShare.direction}
            sparkline={data.kpis.recommendationShare.sparkline}
          />
          <KpiCard
            className="col-span-12 md:col-span-6 lg:col-span-4"
            label={t('kpiCards.totalCitations')}
            value={data.kpis.totalCitations.current}
            delta={data.kpis.totalCitations.delta}
            direction={data.kpis.totalCitations.direction}
            sparkline={data.kpis.totalCitations.sparkline}
          />
          <KpiCard
            className="col-span-12 md:col-span-6 lg:col-span-4"
            label={t('kpiCards.averageSentiment')}
            value={data.kpis.averageSentiment.current}
            delta={data.kpis.averageSentiment.delta}
            direction={data.kpis.averageSentiment.direction}
            sparkline={data.kpis.averageSentiment.sparkline}
          />
        </div>
      )}

      {/* Section grid */}
      <div className="grid grid-cols-12 gap-4">
        <MoversSection movers={data.movers} />
        <OpportunitiesSection opportunities={data.opportunities} />
        <PlatformsSection platforms={data.platforms} />
        <AlertsSection alerts={data.alerts} />
      </div>
    </div>
  );
}
