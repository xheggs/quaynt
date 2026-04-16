'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { queryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/query/types';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { DetailSkeleton } from '@/components/skeletons/detail-skeleton';

import type { NameLookup } from '../model-run.types';
import { isTerminalStatus } from '../model-run.types';
import { fetchModelRun, fetchAdapterConfigs } from '../model-run.api';
import { fetchBrands } from '@/features/brands/brand.api';
import { fetchPromptSets } from '@/features/prompt-sets/prompt-set.api';
import { formatDuration } from '../lib/format-duration';
import { RunStatusBadge } from './run-status-badge';
import { RunProgress } from './run-progress';
import { CancelRunDialog } from './cancel-run-dialog';
import { ResultTable } from './result-table';

interface ModelRunDetailViewProps {
  runId: string;
}

export function ModelRunDetailView({ runId }: ModelRunDetailViewProps) {
  return (
    <ErrorBoundary>
      <ModelRunDetailContent runId={runId} />
    </ErrorBoundary>
  );
}

function ModelRunDetailContent({ runId }: ModelRunDetailViewProps) {
  const t = useTranslations('modelRuns');
  const tUi = useTranslations('ui');
  const locale = useLocale();
  const router = useRouter();

  const [cancelOpen, setCancelOpen] = useState(false);

  const {
    data: run,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.modelRuns.detail(runId),
    queryFn: () => fetchModelRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !isTerminalStatus(status) ? 3000 : false;
    },
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  // Name resolution
  const { data: brandsData } = useQuery({
    queryKey: queryKeys.brands.list({ limit: 100, sort: 'name', order: 'asc' }),
    queryFn: () => fetchBrands({ limit: 100, sort: 'name', order: 'asc' }),
  });
  const { data: promptSetsData } = useQuery({
    queryKey: queryKeys.promptSets.list({ limit: 100, sort: 'name', order: 'asc' }),
    queryFn: () => fetchPromptSets({ limit: 100, sort: 'name', order: 'asc' }),
  });
  const { data: adaptersData } = useQuery({
    queryKey: queryKeys.adapters.list({ limit: 50, sort: 'displayName', order: 'asc' }),
    queryFn: () => fetchAdapterConfigs({ limit: 50, sort: 'displayName', order: 'asc' }),
  });

  const brandNames: NameLookup = useMemo(() => {
    const map: NameLookup = {};
    for (const b of brandsData?.data ?? []) map[b.id] = b.name;
    return map;
  }, [brandsData]);

  const promptSetNames: NameLookup = useMemo(() => {
    const map: NameLookup = {};
    for (const ps of promptSetsData?.data ?? []) map[ps.id] = ps.name;
    return map;
  }, [promptSetsData]);

  const adapterNames: NameLookup = useMemo(() => {
    const map: NameLookup = {};
    for (const a of adaptersData?.data ?? []) map[a.id] = a.displayName;
    return map;
  }, [adaptersData]);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // 404
  if (isError && error instanceof ApiError && error.status === 404) {
    return (
      <ErrorState
        variant="page"
        title={t('errors.notFound')}
        description={tUi('error.notFound.description')}
        onRetry={() => router.push(`/${locale}/model-runs`)}
      />
    );
  }

  if (isError) {
    return <ErrorState variant="section" onRetry={() => refetch()} />;
  }

  if (showSkeleton || !run) {
    return <DetailSkeleton />;
  }

  const isActive = run.status === 'pending' || run.status === 'running';
  const duration = formatDuration(run.startedAt, run.completedAt, t as never);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label={tUi('breadcrumb.label')}>
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link
              href={`/${locale}/model-runs`}
              className="hover:text-foreground transition-colors"
            >
              {t('labels.modelRuns')}
            </Link>
          </li>
          <li>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="font-mono text-foreground font-medium text-xs">
            {run.id.slice(0, 16)}…
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg">{run.id.slice(0, 16)}…</span>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateFormatter.format(new Date(run.createdAt))}
          </p>
        </div>
        {isActive && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="size-4" />
            {t('cancel.confirm')}
          </Button>
        )}
      </div>

      {/* Run info card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('detail.runInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Prompt Set + Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('detail.promptSet')}
              </span>
              <p className="text-sm font-medium">
                {promptSetNames[run.promptSetId] ?? (
                  <span className="font-mono text-xs">{run.promptSetId}</span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{t('detail.brand')}</span>
              <p className="text-sm font-medium">
                {brandNames[run.brandId] ?? (
                  <span className="font-mono text-xs">{run.brandId}</span>
                )}
              </p>
            </div>
          </div>

          {/* Row 2: Locale + Market */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('detail.locale')}
              </span>
              <p className="text-sm">{run.locale ?? t('detail.allLocales')}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t('detail.market')}
              </span>
              <p className="text-sm">{run.market ?? '\u2014'}</p>
            </div>
          </div>

          {/* Row 3: Adapter configs */}
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('detail.adapters')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {run.adapterConfigIds.map((id) => (
                <Badge key={id} variant="outline">
                  {adapterNames[id] ?? (
                    <span className="font-mono text-xs">{id.slice(0, 12)}…</span>
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Metadata footer */}
          <div className="flex gap-6 border-t border-border pt-4">
            <div>
              <span className="type-caption text-muted-foreground">{t('detail.started')}</span>
              <p className="type-caption text-muted-foreground">
                {run.startedAt ? dateFormatter.format(new Date(run.startedAt)) : '\u2014'}
              </p>
            </div>
            <div>
              <span className="type-caption text-muted-foreground">{t('detail.completed')}</span>
              <p className="type-caption text-muted-foreground">
                {run.completedAt ? dateFormatter.format(new Date(run.completedAt)) : '\u2014'}
              </p>
            </div>
            <div>
              <span className="type-caption text-muted-foreground">{t('detail.duration')}</span>
              <p className="type-caption text-muted-foreground">{duration ?? '\u2014'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {run.resultSummary && run.resultSummary.total > 0 && (
        <RunProgress resultSummary={run.resultSummary} variant="full" />
      )}

      {/* Error summary */}
      {run.errorSummary && (
        <div className="rounded-md bg-destructive/10 p-4">
          <h3 className="text-sm font-medium text-destructive">{t('detail.errorSummary')}</h3>
          <p className="mt-1 text-sm text-destructive">{run.errorSummary}</p>
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        <h2 className="type-section">{t('detail.results')}</h2>
        <ResultTable runId={runId} />
      </div>

      {/* Cancel dialog */}
      <CancelRunDialog runId={run.id} open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  );
}
