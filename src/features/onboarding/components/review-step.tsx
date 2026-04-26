'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/query/types';
import { queryKeys } from '@/lib/query/keys';
import { createBrand } from '@/features/brands';
import { createPromptSet, fetchPromptSets, fetchPrompts, addPrompt } from '@/features/prompt-sets';
import { createModelRun } from '@/features/model-runs';
import { fetchAdapters } from '@/features/settings';
import { useUpdateOnboarding } from '@/features/onboarding';
import { useCreateSuggestion, useSuggestion } from '../hooks/use-suggestion';
import { BrandCard } from './review/brand-card';
import { CompetitorsCard } from './review/competitors-card';
import { PromptsCard, type PromptChoice } from './review/prompts-card';
import { errorKeyFor } from './review/error-key';

type Props = { jobId: string };

const STARTER_NAME = 'Quaynt Starter';

export function ReviewStep({ jobId }: Props) {
  const t = useTranslations('onboarding.review');
  const tPrompts = useTranslations('onboarding.review.prompts');
  const tErrors = useTranslations('onboarding.review.errors');
  const tRegen = useTranslations('onboarding.review.regenerate');
  const tGeneric = useTranslations('onboarding.errors');
  const locale = useLocale();
  const router = useRouter();
  const update = useUpdateOnboarding();

  // jobId is lifted to local state so Regenerate can swap to a new job without
  // navigating to a new URL (which would create history entries and disrupt the
  // back-button mental model).
  const [activeJobId, setActiveJobId] = useState(jobId);
  const suggestion = useSuggestion(activeJobId);
  const data = suggestion.data;
  const regenerateMutation = useCreateSuggestion();

  const [brandName, setBrandName] = useState('');
  const [aliasesText, setAliasesText] = useState('');
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<number>>(new Set());
  const [extraCompetitors, setExtraCompetitors] = useState<{ name: string; domain: string }[]>([]);
  const [promptChoice, setPromptChoice] = useState<PromptChoice>('suggested');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmReplace, setShowConfirmReplace] = useState(false);

  useEffect(() => {
    if (!data?.extracted) return;
    if (!brandName) setBrandName(data.extracted.brandName);
    if (!aliasesText && data.extracted.aliases.length) {
      setAliasesText(data.extracted.aliases.join(', '));
    }
  }, [data?.extracted, brandName, aliasesText]);

  useEffect(() => {
    if (data?.suggestedCompetitors) {
      setSelectedCompetitors((prev) =>
        prev.size === 0 ? new Set(data.suggestedCompetitors!.map((_, i) => i)) : prev
      );
    }
    if (
      !data?.suggestedPrompts &&
      data?.suggestedCompetitors === null &&
      data?.engineUsed === null &&
      promptChoice === 'suggested'
    ) {
      setPromptChoice('starter');
    }
  }, [data?.suggestedCompetitors, data?.suggestedPrompts, data?.engineUsed, promptChoice]);

  const isFetching = !data || data.status === 'pending' || data.status === 'fetching';
  const isSuggesting = data?.status === 'suggesting';
  const isFailed = data?.status === 'failed';
  const isDone = data?.status === 'done';
  const noEngine = isDone && data?.engineUsed === null;
  const engineAvailable = isDone && data?.engineUsed !== null;

  // Pre-seed one empty competitor row in no-engine mode so the manual-entry
  // affordance is visible immediately rather than gated behind "Add another".
  useEffect(() => {
    if (noEngine && extraCompetitors.length === 0) {
      setExtraCompetitors([{ name: '', domain: '' }]);
    }
  }, [noEngine, extraCompetitors.length]);

  const promptSets = useQuery({
    queryKey: queryKeys.promptSets.list({ page: 1, limit: 50 }),
    queryFn: () => fetchPromptSets({ page: 1, limit: 50 }),
    staleTime: 60_000,
  });
  const starter = useMemo(
    () => promptSets.data?.data.find((p) => p.name === STARTER_NAME) ?? null,
    [promptSets.data]
  );
  const starterPrompts = useQuery({
    queryKey: ['promptSets', 'prompts', starter?.id ?? ''],
    queryFn: () => fetchPrompts(starter!.id),
    enabled: Boolean(starter?.id),
    staleTime: 60_000,
  });

  const adapters = useQuery({
    queryKey: queryKeys.adapters.list({ page: 1, limit: 50 }),
    queryFn: () => fetchAdapters({ page: 1, limit: 50 }),
    staleTime: 60_000,
  });
  const enabledAdapters = useMemo(
    () => adapters.data?.data.filter((a) => a.enabled && a.credentialsSet && !a.deletedAt) ?? [],
    [adapters.data]
  );

  const brandReady = Boolean(brandName.trim());

  const hasUserEdits = useMemo(() => {
    if (!data?.extracted) return false;
    if (brandName.trim() !== data.extracted.brandName.trim()) return true;
    const originalAliases = data.extracted.aliases.join(', ');
    if (aliasesText.trim() !== originalAliases.trim()) return true;
    if (extraCompetitors.length > 0) return true;
    if (data.suggestedCompetitors) {
      const defaultSelected = data.suggestedCompetitors.length;
      if (selectedCompetitors.size !== defaultSelected) return true;
    }
    return false;
  }, [data, brandName, aliasesText, extraCompetitors, selectedCompetitors]);

  async function runRegenerate() {
    if (!data?.domain) return;
    setShowConfirmReplace(false);
    try {
      const fresh = await regenerateMutation.mutateAsync({
        domain: data.domain,
        regenerate: true,
        fromJobId: activeJobId,
      });
      // Reset local form state — new suggestions are about to land.
      setBrandName('');
      setAliasesText('');
      setSelectedCompetitors(new Set());
      setExtraCompetitors([]);
      setPromptChoice('suggested');
      setActiveJobId(fresh.id);
      toast.success(tRegen('successToast'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast.error(tRegen('rateLimited'));
        return;
      }
      toast.error(tRegen('error'));
    }
  }

  function handleRegenerateClick() {
    if (hasUserEdits) {
      setShowConfirmReplace(true);
      return;
    }
    void runRegenerate();
  }

  async function handleSubmit() {
    if (!data?.extracted || !brandReady) return;
    setSubmitting(true);
    try {
      const aliases = aliasesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      const brand = await createBrand({
        name: brandName.trim(),
        domain: data.domain || undefined,
        aliases,
        description: data.extracted.description ?? undefined,
      });

      const selected = (data.suggestedCompetitors ?? []).filter((_, i) =>
        selectedCompetitors.has(i)
      );
      const extras = extraCompetitors.filter((c) => c.name.trim());
      for (const c of [
        ...selected.map((s) => ({ name: s.name, domain: s.domain ?? '' })),
        ...extras,
      ]) {
        try {
          await createBrand({
            name: c.name.trim(),
            domain: c.domain?.trim() || undefined,
            metadata: { role: 'competitor' },
          });
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 409)) throw e;
        }
      }
      const hasCompetitors = selected.length > 0 || extras.length > 0;

      let promptSetId: string | null = null;
      if (
        promptChoice === 'suggested' &&
        data.suggestedPrompts &&
        data.suggestedPrompts.length > 0
      ) {
        const created = await createPromptSet({
          name: tPrompts('promptSetName', { brand: brand.name }),
          tags: ['auto-suggested'],
        });
        await Promise.all(
          data.suggestedPrompts.map((p, idx) =>
            addPrompt(created.id, { template: p.text, order: idx })
          )
        );
        promptSetId = created.id;
      } else if (promptChoice === 'starter' && starter) {
        promptSetId = starter.id;
      }

      const promptSetSelected = promptSetId !== null;

      let firstRunTriggered = false;
      let runId: string | null = null;
      if (promptSetId && enabledAdapters.length > 0) {
        try {
          const run = await createModelRun({
            promptSetId,
            brandId: brand.id,
            adapterConfigIds: enabledAdapters.map((a) => a.id),
            locale,
          });
          firstRunTriggered = true;
          runId = run.id;
        } catch (e) {
          console.warn('Failed to trigger first run', e);
        }
      }

      const destination =
        firstRunTriggered && runId
          ? `/${locale}/onboarding/first-run/${runId}`
          : `/${locale}/dashboard`;

      update.mutate(
        {
          milestones: {
            brandAdded: true,
            competitorsAdded: hasCompetitors,
            promptSetSelected,
            firstRunTriggered,
          },
          step: firstRunTriggered ? 'first_run' : promptSetSelected ? 'prompt_set' : 'competitors',
        },
        {
          onSuccess: () => router.push(destination),
        }
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : tGeneric('generic');
      toast.error(message);
      setSubmitting(false);
    }
  }

  const errorCopy = isFailed ? tErrors(errorKeyFor(data?.error)) : null;
  const host = data?.domain ?? null;
  const subtitleHostKey = noEngine
    ? host
      ? 'heroSubtitleNoEngine'
      : 'heroSubtitleNoEngineNoHost'
    : host
      ? 'heroSubtitle'
      : 'heroSubtitleNoHost';
  const showRegenerate = engineAvailable || isFailed;
  const regenerating = regenerateMutation.isPending;
  const regenerateDisabled =
    regenerating || isFetching || isSuggesting || submitting || update.isPending;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('heroTitle')}
        </h1>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-prose text-base text-muted-foreground">
            {host
              ? t.rich(subtitleHostKey, {
                  host: (chunks) => <code className="font-mono">{chunks}</code>,
                  hostName: host,
                })
              : t(subtitleHostKey)}
          </p>
          {showRegenerate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRegenerateClick}
              disabled={regenerateDisabled}
              title={tRegen('tooltip')}
              className="-mr-2 shrink-0 text-muted-foreground"
            >
              <RotateCcw
                className={`mr-1.5 size-4 ${regenerating ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {regenerating ? tRegen('inflight') : tRegen('cta')}
            </Button>
          ) : null}
        </div>
        {showConfirmReplace ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span>{tRegen('confirmTitle')}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirmReplace(false)}
              >
                {tRegen('confirmCancelCta')}
              </Button>
              <Button type="button" size="sm" onClick={() => void runRegenerate()}>
                {tRegen('confirmReplaceCta')}
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      {isFailed && errorCopy ? (
        <Card>
          <CardHeader>
            <CardTitle>{errorCopy}</CardTitle>
            <CardDescription>{t('fallback.body')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/${locale}/onboarding/brand`}>{t('fallback.cta')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <BrandCard
            isLoading={isFetching}
            brandName={brandName}
            aliasesText={aliasesText}
            onBrandNameChange={setBrandName}
            onAliasesChange={setAliasesText}
            host={data?.domain ?? null}
          />

          <CompetitorsCard
            isLoading={isFetching || isSuggesting}
            noEngine={Boolean(noEngine && !data?.suggestedCompetitors)}
            partialError={
              data?.error?.stage === 'competitors' ? tErrors(errorKeyFor(data?.error)) : null
            }
            competitors={data?.suggestedCompetitors ?? []}
            selected={selectedCompetitors}
            extras={extraCompetitors}
            onToggle={(idx) => {
              setSelectedCompetitors((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx);
                else next.add(idx);
                return next;
              });
            }}
            onAddExtra={() => setExtraCompetitors((prev) => [...prev, { name: '', domain: '' }])}
            onUpdateExtra={(idx, patch) =>
              setExtraCompetitors((prev) =>
                prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
              )
            }
            onRemoveExtra={(idx) => setExtraCompetitors((prev) => prev.filter((_, i) => i !== idx))}
            locale={locale}
            revealDelay="motion-safe:delay-150"
            brandName={brandName.trim() || undefined}
          />

          <PromptsCard
            isLoading={isFetching || isSuggesting}
            noEngine={Boolean(noEngine && !data?.suggestedPrompts)}
            partialError={
              data?.error?.stage === 'prompts' ? tErrors(errorKeyFor(data?.error)) : null
            }
            prompts={data?.suggestedPrompts ?? []}
            choice={promptChoice}
            onChoiceChange={setPromptChoice}
            starterAvailable={Boolean(starter)}
            starterPromptCount={starterPrompts.data?.length ?? 0}
            locale={locale}
            revealDelay="motion-safe:delay-300"
          />

          <div className="flex flex-col items-end gap-2">
            <Button
              type="button"
              size="lg"
              onClick={handleSubmit}
              disabled={!brandReady || submitting || update.isPending || isFetching}
            >
              {brandReady ? t('cta.run') : t('cta.disabled')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
