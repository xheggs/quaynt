'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { useQueryFanout, useSimulateQueryFanout } from './use-query-fanout';
import type {
  QueryFanoutSource,
  QueryFanoutSubQuery,
  QueryFanoutTree,
  SimulateFailureReason,
} from './query-fanout.api';

/**
 * Platforms whose adapter emits observed fan-out. Any other platform must
 * rely on the simulator to populate the panel.
 */
const OBSERVED_PLATFORMS = new Set(['gemini', 'aio', 'chatgpt']);

interface QueryFanoutSectionProps {
  modelRunId: string;
  modelRunResultId: string;
  platformId: string;
  promptId: string;
}

export function QueryFanoutSection({
  modelRunId,
  modelRunResultId,
  platformId,
  promptId,
}: QueryFanoutSectionProps) {
  const t = useTranslations('queryFanout');
  const [open, setOpen] = useState(false);
  const [showInferred, setShowInferred] = useState(false);

  const source = showInferred ? 'both' : 'observed';
  const { data, isLoading, isError, refetch } = useQueryFanout(
    modelRunId,
    modelRunResultId,
    open,
    source
  );

  const simulate = useSimulateQueryFanout(modelRunResultId);

  const observedAvailable = OBSERVED_PLATFORMS.has(platformId);
  const simulatedCount = useMemo(
    () => data?.flatMap((tree) => tree.subQueries).filter((sq) => sq.isSimulated).length ?? 0,
    [data]
  );
  const hasObserved =
    (data?.flatMap((tree) => tree.subQueries).filter((sq) => !sq.isSimulated).length ?? 0) > 0;
  const noDataYet = !isLoading && (!data || data.length === 0);

  // If user toggles on "Show inferred" and there's no simulated data yet,
  // auto-refetch (in case the caller just simulated from another tab).
  useEffect(() => {
    if (showInferred) refetch();
  }, [showInferred, refetch]);

  const failureReason =
    simulate.data && 'failure' in simulate.data ? simulate.data.failure.reason : null;
  const retryAfterMs =
    simulate.data && 'failure' in simulate.data ? simulate.data.failure.retryAfterMs : null;

  const handleGenerate = () => {
    simulate.mutate({ promptId, modelRunId });
  };

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
        {t('section.title')}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {isLoading ? (
            <EmptyMessage>…</EmptyMessage>
          ) : isError ? (
            <EmptyMessage>{t('error.loadFailed')}</EmptyMessage>
          ) : null}

          {!isLoading && !isError && (
            <>
              {observedAvailable && hasObserved && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInferred}
                    onChange={(e) => setShowInferred(e.target.checked)}
                    className="size-3"
                  />
                  {t('panel.showInferred')}
                </label>
              )}

              {data && data.length > 0 ? (
                data.map((tree) => <QueryFanoutTreeView key={tree.modelRunResultId} tree={tree} />)
              ) : noDataYet && !observedAvailable ? (
                <EmptyMessage>{t('empty.notAvailableOnPlatform')}</EmptyMessage>
              ) : noDataYet ? (
                <EmptyMessage>{t('empty.noFanoutYet')}</EmptyMessage>
              ) : null}

              {/* Inferred generation affordance — visible whenever there are no simulated rows yet and the mutation hasn't fatally failed. */}
              {simulatedCount === 0 && failureReason !== 'no_simulation_provider_configured' && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={simulate.isPending || isRetryDisabled(failureReason, retryAfterMs)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
                  >
                    <Sparkles className="size-3" />
                    {simulate.isPending
                      ? t('panel.generatingInferred')
                      : t('panel.generateInferred')}
                  </button>
                  {simulatedCount === 0 && showInferred && !simulate.isPending && (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      {t('panel.inferredDisclaimer')}
                    </p>
                  )}
                </div>
              )}

              <SimulationErrorBanner reason={failureReason} retryAfterMs={retryAfterMs} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function isRetryDisabled(
  reason: SimulateFailureReason | null,
  retryAfterMs: number | null | undefined
): boolean {
  return (
    reason === 'simulation_rate_limited' && typeof retryAfterMs === 'number' && retryAfterMs > 0
  );
}

function SimulationErrorBanner({
  reason,
  retryAfterMs,
}: {
  reason: SimulateFailureReason | null;
  retryAfterMs: number | null | undefined;
}) {
  const t = useTranslations('queryFanout');
  if (!reason) return null;

  if (reason === 'no_simulation_provider_configured') {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
        <p>{t('simulator.noProviderConfigured')}</p>
        <Link
          href="/settings/adapters"
          className="mt-1 inline-block font-medium text-primary hover:underline"
        >
          {t('simulator.providerConfigureLink')}
        </Link>
      </div>
    );
  }

  const messageKey =
    reason === 'simulation_rate_limited'
      ? ('simulator.error.rateLimited' as const)
      : reason === 'simulation_timeout'
        ? ('simulator.error.timeout' as const)
        : reason === 'simulation_parse_failed'
          ? ('simulator.error.parse' as const)
          : ('simulator.error.generic' as const);

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
      <p>{t(messageKey)}</p>
      {typeof retryAfterMs === 'number' && retryAfterMs > 0 && (
        <p className="mt-1 text-muted-foreground">{Math.ceil(retryAfterMs / 1000)}s</p>
      )}
    </div>
  );
}

function QueryFanoutTreeView({ tree }: { tree: QueryFanoutTree }) {
  const t = useTranslations('queryFanout');
  const attribution = resolveAttributionKey(tree);

  return (
    <div className="space-y-2">
      {attribution && (
        <p className="text-xs italic text-muted-foreground">
          {t(`attributionNote.${attribution}` as 'attributionNote.rootOnly')}
        </p>
      )}

      {tree.subQueries.length > 0 && (
        <ul className="space-y-1">
          {tree.subQueries.map((subQuery) => (
            <li key={subQuery.id}>
              <SubQueryRow subQuery={subQuery} />
            </li>
          ))}
        </ul>
      )}

      {tree.rootSources.length > 0 && (
        <details className="rounded-md bg-muted/50 p-2">
          <summary className="cursor-pointer text-sm font-medium">
            {t('section.rootSourcesLabel')}
            <span className="ml-2 text-xs text-muted-foreground">
              {t('section.sourceCount', { count: tree.rootSources.length })}
            </span>
          </summary>
          <ul className="mt-2 space-y-1">
            {tree.rootSources.map((source) => (
              <SourceLink key={source.id} source={source} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function SubQueryRow({ subQuery }: { subQuery: QueryFanoutSubQuery }) {
  const t = useTranslations('queryFanout');
  const attribution =
    subQuery.isSimulated && subQuery.simulationProvider && subQuery.simulationModel
      ? t('panel.modelAttribution', {
          provider: subQuery.simulationProvider,
          model: subQuery.simulationModel,
        })
      : null;

  return (
    <details className={cn('rounded-md p-2', subQuery.isSimulated ? 'bg-muted/30' : 'bg-muted/50')}>
      <summary className="cursor-pointer text-sm font-medium">
        {subQuery.isSimulated && (
          <span className="mr-2 inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] font-normal uppercase tracking-wide text-primary">
            <Sparkles className="size-2.5" />
            {t('panel.inferredBadge')}
          </span>
        )}
        {subQuery.text}
        {!subQuery.isSimulated && (
          <span className="ml-2 text-xs text-muted-foreground">
            {t('section.sourceCount', { count: subQuery.sources.length })}
          </span>
        )}
      </summary>
      {attribution && <p className="mt-1 text-xs italic text-muted-foreground">{attribution}</p>}
      {subQuery.sources.length > 0 && (
        <ul className="mt-2 space-y-1">
          {subQuery.sources.map((source) => (
            <SourceLink key={source.id} source={source} />
          ))}
        </ul>
      )}
    </details>
  );
}

function SourceLink({ source }: { source: QueryFanoutSource }) {
  return (
    <li className="text-xs">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-3" />
        <span>{source.title || source.url}</span>
      </a>
    </li>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function resolveAttributionKey(tree: QueryFanoutTree): 'rootOnly' | 'sourcesUnavailable' | null {
  const rootMeta = tree.rootMetadata;
  if (!rootMeta) return null;
  if (rootMeta.groundingAttribution === 'root-only') return 'rootOnly';
  if (rootMeta.sourcesAttached === false) return 'sourcesUnavailable';
  return null;
}
