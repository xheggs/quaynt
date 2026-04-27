'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query/keys';
import { fetchModelRun, fetchAdapterConfigs } from '@/features/model-runs/model-run.api';
import { fetchCitations } from '@/features/citations/citation.api';
import { fetchPrompts } from '@/features/prompt-sets';
import { isTerminalStatus } from '@/features/model-runs/model-run.types';
import { useOnboarding, useUpdateOnboarding } from '@/features/onboarding/hooks/use-onboarding';
import type { OnboardingRoleHint } from '@/features/onboarding/types';
import { RunStatusBadge } from '@/features/model-runs/components/run-status-badge';
import { KpiPlaceholder } from './kpi-placeholder';
import { WowCard } from './wow-card';
import { CitationStreamItem } from './citation-stream-item';
import { PersonaChipRow } from './persona-chip-row';
import { OnboardingPageHeader } from './onboarding-page-header';

interface Props {
  runId: string;
}

export function FirstRunProgress({ runId }: Props) {
  const t = useTranslations('onboarding.firstRun');
  const tTerminal = useTranslations('onboarding.firstRun.terminal');
  const locale = useLocale();
  const updateOnboarding = useUpdateOnboarding();
  const { data: onboarding } = useOnboarding();
  const firstCitationSeen = onboarding?.milestones.firstCitationSeen ?? false;
  const currentRole = (onboarding?.roleHint ?? null) as OnboardingRoleHint | null;

  const { data: run } = useQuery({
    queryKey: queryKeys.modelRuns.detail(runId),
    queryFn: () => fetchModelRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !isTerminalStatus(status) ? 3000 : false;
    },
  });

  const status = run?.status;
  const terminal = status ? isTerminalStatus(status) : false;

  const { data: citations } = useQuery({
    queryKey: queryKeys.citations.list({
      modelRunId: runId,
      sort: 'createdAt',
      order: 'asc',
      limit: 25,
    }),
    queryFn: () =>
      fetchCitations({ modelRunId: runId, sort: 'createdAt', order: 'asc', limit: 25 }),
    refetchInterval: terminal ? false : 3000,
  });

  // Focused earned-citation watcher — drives the wow card. Using a separate
  // tiny query keeps the wow trigger independent of the streaming list's
  // ordering and pagination.
  const { data: firstEarned } = useQuery({
    queryKey: queryKeys.citations.list({
      modelRunId: runId,
      citationType: 'earned',
      sort: 'createdAt',
      order: 'asc',
      limit: 1,
    }),
    queryFn: () =>
      fetchCitations({
        modelRunId: runId,
        citationType: 'earned',
        sort: 'createdAt',
        order: 'asc',
        limit: 1,
      }),
    refetchInterval: terminal ? false : 3000,
  });

  const { data: adapters } = useQuery({
    queryKey: queryKeys.adapters.list({ limit: 50 }),
    queryFn: () => fetchAdapterConfigs({ limit: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  const promptSetId = run?.promptSetId ?? null;
  const { data: prompts } = useQuery({
    queryKey: ['promptSets', 'prompts', promptSetId ?? ''],
    queryFn: () => fetchPrompts(promptSetId!),
    enabled: Boolean(promptSetId),
    staleTime: 60_000,
  });

  const adapterNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of adapters?.data ?? []) map.set(a.id, a.displayName);
    return map;
  }, [adapters]);

  const earnedCount = useMemo(
    () => (citations?.data ?? []).filter((c) => c.citationType === 'earned').length,
    [citations]
  );

  const heroCitation = firstEarned?.data?.[0] ?? null;

  // Terminal-state CTA + summary copy.
  const terminalKind: 'completed' | 'partial' | 'failed' | 'cancelled' | null =
    status === 'completed' || status === 'partial' || status === 'failed' || status === 'cancelled'
      ? status
      : null;

  const completedCount = run?.resultSummary.completed ?? 0;
  const totalCount = run?.resultSummary.total ?? 0;

  return (
    <div className="flex flex-col gap-10">
      <OnboardingPageHeader
        phase="watch"
        title={t('title')}
        subtitle={t('subtitle')}
        secondary={
          <span aria-live="polite" aria-atomic="true" data-testid="first-run-progress-announcer">
            {t('progress', { done: completedCount, total: totalCount })} · {t('eta')}
          </span>
        }
      />

      {heroCitation ? (
        <WowCard
          citation={heroCitation}
          onDismiss={() => updateOnboarding.mutate({ milestones: { firstCitationSeen: true } })}
          viewAllHref={`/${locale}/dashboard`}
        />
      ) : null}

      {firstCitationSeen ? <PersonaChipRow currentRole={currentRole} /> : null}

      {/* Prompts being run — closes the cognitive thread from the review page */}
      {prompts && prompts.length > 0 ? (
        <PromptsBeingRun prompts={prompts} engineCount={run?.adapterSummary.length ?? 0} />
      ) : null}

      {/* Per-adapter status grid */}
      <section aria-label={t('adapterGridLabel')}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('adapterGridLabel')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {(run?.adapterSummary ?? []).map((a) => {
              const display = adapterNames.get(a.adapterConfigId) ?? a.adapterConfigId;
              const remaining = a.pending + a.running;
              const adapterStatus = (() => {
                if (a.failed > 0 && remaining === 0 && a.completed === 0) return 'failed';
                if (a.completed > 0 && remaining === 0) return 'completed';
                if (a.running > 0) return 'running';
                if (a.pending > 0) return 'pending';
                if (a.skipped > 0) return 'skipped';
                return 'pending';
              })();

              return (
                <div
                  key={a.adapterConfigId}
                  className="flex flex-col gap-2 rounded-md border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{display}</span>
                    <RunStatusBadge status={adapterStatus} variant="result" size="sm" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('adapterProgress', { done: a.completed, total: a.total })}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* KPI placeholders */}
      <section aria-label={t('kpis.sectionLabel')}>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiPlaceholder
            kind="recommendation-share"
            terminal={terminal}
            terminalKind={terminalKind}
            earnedCount={earnedCount}
          />
          <KpiPlaceholder
            kind="citation-count"
            terminal={terminal}
            terminalKind={terminalKind}
            earnedCount={earnedCount}
          />
          <KpiPlaceholder
            kind="sentiment"
            terminal={terminal}
            terminalKind={terminalKind}
            earnedCount={earnedCount}
          />
        </div>
      </section>

      {/* Citations stream */}
      <section aria-label={t('citations.title')}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('citations.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(citations?.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {terminal ? t('citations.streaming') : t('citations.emptyWaiting')}
              </p>
            ) : (
              <ul
                className={cn(
                  'flex flex-col gap-3',
                  (citations?.data ?? []).length > 5 ? 'max-h-72 overflow-auto' : null
                )}
              >
                {(citations?.data ?? []).map((c) => (
                  <li key={c.id}>
                    <CitationStreamItem citation={c} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Terminal state UI */}
      {terminalKind === 'completed' || terminalKind === 'partial' ? (
        earnedCount > 0 ? (
          <Button asChild>
            <Link href={`/${locale}/dashboard`}>{tTerminal('completed.primaryCta')}</Link>
          </Button>
        ) : (
          <NoCitationsPanel
            runId={runId}
            onAcknowledge={() =>
              updateOnboarding.mutate({ milestones: { firstCitationSeen: true } })
            }
          />
        )
      ) : null}

      {terminalKind === 'failed' ? (
        <Card role="alert">
          <CardHeader>
            <CardTitle>{tTerminal('failed.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{tTerminal('failed.body')}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/${locale}/model-runs/new`}>{tTerminal('failed.primaryCta')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${locale}/settings/integrations`}>
                  {tTerminal('failed.secondaryCta')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {terminalKind === 'cancelled' ? (
        <CancelledPanel
          locale={locale}
          onAcknowledge={() => updateOnboarding.mutate({ milestones: { firstCitationSeen: true } })}
        />
      ) : null}
    </div>
  );
}

function NoCitationsPanel({ runId, onAcknowledge }: { runId: string; onAcknowledge: () => void }) {
  const t = useTranslations('onboarding.firstRun.terminal.noCitations');
  const locale = useLocale();

  // Defensive PATCH: the dashboard wow-card host should not flash for a run
  // that produced zero earned citations.
  useAcknowledgeOnce(onAcknowledge);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t('body')}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/${locale}/dashboard`}>{t('primaryCta')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/model-runs/${runId}`}>{t('secondaryCta')}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CancelledPanel({ locale, onAcknowledge }: { locale: string; onAcknowledge: () => void }) {
  const t = useTranslations('onboarding.firstRun.terminal.cancelled');
  useAcknowledgeOnce(onAcknowledge);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t('body')}</p>
        <Button asChild>
          <Link href={`/${locale}/model-runs/new`}>{t('primaryCta')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PromptsBeingRun({
  prompts,
  engineCount,
}: {
  prompts: { id: string; template: string }[];
  engineCount: number;
}) {
  const t = useTranslations('onboarding.firstRun.prompts');
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-label={t('title')}>
      <Card>
        <CardHeader>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="first-run-prompts-list"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex flex-col gap-1">
              <CardTitle className="text-sm">{t('title')}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {t('summary', { count: prompts.length, engines: engineCount })}
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {expanded ? t('collapse') : t('expand')}
              {expanded ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
            </span>
          </button>
        </CardHeader>
        {expanded ? (
          <CardContent id="first-run-prompts-list">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-xs">
              {prompts.map((p) => (
                <li key={p.id} className="font-mono">
                  {p.template}
                </li>
              ))}
            </ol>
          </CardContent>
        ) : null}
      </Card>
    </section>
  );
}

// Fires the dismiss/acknowledge callback exactly once on mount. Used by the
// no-citations and cancelled panels to flip `firstCitationSeen=true` so the
// dashboard host does not re-show a wow card for a run that will never have
// one.
function useAcknowledgeOnce(cb: () => void) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    cb();
  }, [cb]);
}
