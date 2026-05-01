'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/query/types';
import { translateApiError } from '@/lib/query/error-messages';
import { queryKeys } from '@/lib/query/keys';
import { createBrand, fetchBrands, type Brand, type CreateBrandInput } from '@/features/brands';
import {
  createPromptSet,
  fetchPromptSets,
  fetchPrompts,
  addPrompt,
  deletePromptSet,
} from '@/features/prompt-sets';
import { createModelRun } from '@/features/model-runs';
import { fetchAdapters } from '@/features/settings';
import { useUpdateOnboarding } from '@/features/onboarding';
import { useCreateSuggestion, useSuggestion } from '../hooks/use-suggestion';
import { OnboardingPageHeader } from './onboarding-page-header';
import { BrandCard } from './review/brand-card';
import { CompetitorsCard } from './review/competitors-card';
import { PromptsCard, type PromptChoice, type PromptEntry } from './review/prompts-card';
import { StageLoading } from './review/stage-loading';
import { errorKeyFor } from './review/error-key';

type Props = { jobId: string };

const STARTER_NAME = 'Quaynt Starter';

export function ReviewStep({ jobId }: Props) {
  const t = useTranslations('onboarding.review');
  const tPrompts = useTranslations('onboarding.review.prompts');
  const tErrors = useTranslations('onboarding.review.errors');
  const tRegen = useTranslations('onboarding.review.regenerate');
  const tGeneric = useTranslations('onboarding.errors');
  const tApiErrors = useTranslations('errors.api');
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
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasesTouched, setAliasesTouched] = useState(false);
  const [aliasSeed, setAliasSeed] = useState<{
    source: 'extracted' | 'ai';
    value: string[];
  } | null>(null);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<number>>(new Set());
  const [extraCompetitors, setExtraCompetitors] = useState<{ name: string; domain: string }[]>([]);
  const [promptChoice, setPromptChoice] = useState<PromptChoice>('suggested');
  // Editable copy of the AI-suggested prompts. `null` means "not yet seeded from
  // suggestion data"; once seeded, edits live here so the user can delete/add
  // prompts before submitting. Reset to `null` on regenerate so fresh
  // suggestions re-seed.
  const [editedPrompts, setEditedPrompts] = useState<PromptEntry[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmReplace, setShowConfirmReplace] = useState(false);

  useEffect(() => {
    if (!data?.extracted) return;
    if (!brandName) setBrandName(data.extracted.brandName);
    if (!aliasesTouched && aliases.length === 0) {
      if (data.extracted.aliases.length) {
        setAliases(data.extracted.aliases);
        setAliasSeed({ source: 'extracted', value: data.extracted.aliases });
      } else if (data.suggestedAliases && data.suggestedAliases.length) {
        setAliases(data.suggestedAliases);
        setAliasSeed({ source: 'ai', value: data.suggestedAliases });
      }
    }
  }, [data?.extracted, data?.suggestedAliases, brandName, aliases.length, aliasesTouched]);

  useEffect(() => {
    if (editedPrompts === null && data?.suggestedPrompts && data.suggestedPrompts.length > 0) {
      setEditedPrompts(data.suggestedPrompts);
    }
  }, [data?.suggestedPrompts, editedPrompts]);

  useEffect(() => {
    if (data?.suggestedCompetitors) {
      setSelectedCompetitors((prev) =>
        prev.size === 0 ? new Set(data.suggestedCompetitors!.map((_, i) => i)) : prev
      );
    }
    const hasFinalised = data?.status === 'done' || data?.status === 'failed';
    const lacksSuggestedPrompts =
      !data?.suggestedPrompts || (data.status === 'done' && data.engineUsed === null);
    if (hasFinalised && lacksSuggestedPrompts && promptChoice === 'suggested') {
      setPromptChoice('starter');
    }
  }, [
    data?.status,
    data?.suggestedCompetitors,
    data?.suggestedPrompts,
    data?.engineUsed,
    promptChoice,
  ]);

  const isFetching = !data || data.status === 'pending' || data.status === 'fetching';
  const isSuggesting = data?.status === 'suggesting';
  const isFailed = data?.status === 'failed';
  const isDone = data?.status === 'done';
  const noEngine = isDone && data?.engineUsed === null;
  const engineAvailable = isDone && data?.engineUsed !== null;
  // Manual mode covers any state where suggestion data isn't usable: no engine
  // configured, or the suggestion job failed outright. The cards behave the
  // same in both: empty defaults, manual-entry affordances visible by default.
  const manualMode = noEngine || isFailed;

  useEffect(() => {
    if (manualMode && extraCompetitors.length === 0) {
      setExtraCompetitors([{ name: '', domain: '' }]);
    }
  }, [manualMode, extraCompetitors.length]);

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
    const seedValues = aliasSeed?.value ?? [];
    const seedKey = seedValues.map((a) => a.trim()).join('|');
    const currentKey = aliases.map((a) => a.trim()).join('|');
    if (seedKey !== currentKey) return true;
    if (extraCompetitors.length > 0) return true;
    if (data.suggestedCompetitors) {
      const defaultSelected = data.suggestedCompetitors.length;
      if (selectedCompetitors.size !== defaultSelected) return true;
    }
    if (editedPrompts && data.suggestedPrompts) {
      const seedPromptKey = data.suggestedPrompts.map((p) => p.text.trim()).join('|');
      const currentPromptKey = editedPrompts.map((p) => p.text.trim()).join('|');
      if (seedPromptKey !== currentPromptKey) return true;
    }
    return false;
  }, [data, brandName, aliases, aliasSeed, extraCompetitors, selectedCompetitors, editedPrompts]);

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
      setAliases([]);
      setAliasesTouched(false);
      setAliasSeed(null);
      setSelectedCompetitors(new Set());
      setExtraCompetitors([]);
      setPromptChoice('suggested');
      setEditedPrompts(null);
      setActiveJobId(fresh.id);
      toast.success(tRegen('successToast'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast.error(tRegen('rateLimited'));
        return;
      }
      if (err instanceof ApiError) {
        console.error('Regenerate failed', {
          status: err.status,
          code: err.code,
          message: err.message,
        });
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

  // On 409 from createBrand, look up the existing brand by exact name in this
  // workspace and reuse it. Onboarding submit is a multi-step pipeline that may
  // partially fail after the brand row is committed; without this, the user is
  // stuck because the second submit attempt hits the unique-name constraint.
  async function ensureBrand(input: CreateBrandInput): Promise<Brand> {
    try {
      return await createBrand(input);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const page = await fetchBrands({ page: 1, limit: 50, search: input.name });
        const match = page.data.find((b) => b.name === input.name);
        if (match) return match;
      }
      throw err;
    }
  }

  // Same idempotency story as ensureBrand: on 409, the prior submit left an
  // auto-suggested set with this name. If it was ours (auto-suggested tag),
  // delete and retry so prompts stay in sync with the user's current edits.
  // If a user-owned set already has this name, reuse it without overwriting.
  async function ensureAutoSuggestedPromptSet(
    name: string
  ): Promise<{ id: string; reused: boolean }> {
    try {
      const created = await createPromptSet({ name, tags: ['auto-suggested'] });
      return { id: created.id, reused: false };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const page = await fetchPromptSets({ page: 1, limit: 50, search: name });
        const exact = page.data.find((ps) => ps.name === name);
        if (exact && exact.tags.includes('auto-suggested')) {
          await deletePromptSet(exact.id);
          const created = await createPromptSet({ name, tags: ['auto-suggested'] });
          return { id: created.id, reused: false };
        }
        if (exact) {
          return { id: exact.id, reused: true };
        }
      }
      throw err;
    }
  }

  async function handleSubmit() {
    if (!brandReady) return;
    setSubmitting(true);
    try {
      const cleanedAliases = aliases
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 10);
      const brand = await ensureBrand({
        name: brandName.trim(),
        domain: data?.domain || undefined,
        aliases: cleanedAliases,
        description: data?.extracted?.description ?? undefined,
      });

      const selected = (data?.suggestedCompetitors ?? []).filter((_, i) =>
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

      let promptSetId: string | null = null;
      // Use the edited prompts if the user has touched them; otherwise fall
      // back to the AI-suggested originals.
      const promptsToSave = (editedPrompts ?? data?.suggestedPrompts ?? [])
        .map((p) => ({ ...p, text: p.text.trim() }))
        .filter((p) => p.text.length > 0);
      if (promptChoice === 'suggested' && promptsToSave.length > 0) {
        const expectedName = tPrompts('promptSetName', { brand: brand.name });
        // Dedupe: a prior review submit (or regenerate after dashboard exit) may
        // have left an auto-suggested set with this exact name. Best-effort
        // delete before creating a fresh one so the prompt-sets list doesn't
        // accumulate stale duplicates. The local cache may be stale (staleTime
        // 60s), so the 409 fallback below covers the case where it missed one.
        const stale = (promptSets.data?.data ?? []).filter(
          (ps) => ps.tags.includes('auto-suggested') && ps.name === expectedName
        );
        for (const old of stale) {
          try {
            await deletePromptSet(old.id);
          } catch (e) {
            console.warn('Failed to delete stale auto-suggested prompt set', e);
          }
        }
        const ensured = await ensureAutoSuggestedPromptSet(expectedName);
        if (!ensured.reused) {
          await Promise.all(
            promptsToSave.map((p, idx) => addPrompt(ensured.id, { template: p.text, order: idx }))
          );
        }
        promptSetId = ensured.id;
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

      // If we triggered a run, advance the step machine and route to the run
      // progress screen. If we couldn't (no enabled adapter, or createModelRun
      // threw silently above), DO NOT set step:'first_run' — the (app) layout
      // redirects that state with no activeRunId back to /welcome, trapping the
      // user. Dismiss instead so they can navigate freely, surface a toast
      // explaining why, and route to the most actionable next screen.
      if (firstRunTriggered && runId) {
        update.mutate(
          {
            milestones: {
              brandAdded: true,
              competitorsAdded: true,
              promptSetSelected,
              firstRunTriggered: true,
            },
            step: 'first_run',
          },
          {
            onSuccess: () => router.push(`/${locale}/onboarding/first-run/${runId}`),
          }
        );
      } else {
        const noAdapter = enabledAdapters.length === 0;
        toast.message(noAdapter ? tErrors('noAdapter') : tErrors('runFailed'));
        update.mutate(
          {
            milestones: {
              brandAdded: true,
              competitorsAdded: true,
              promptSetSelected,
              firstRunTriggered: false,
            },
            dismissedAt: new Date().toISOString(),
          },
          {
            onSuccess: () =>
              router.push(noAdapter ? `/${locale}/settings/adapters` : `/${locale}/model-runs`),
          }
        );
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? translateApiError(tApiErrors, err) : tGeneric('generic');
      toast.error(message);
      setSubmitting(false);
    }
  }

  const errorCopy = isFailed ? tErrors(errorKeyFor(data?.error)) : null;
  const host = data?.domain ?? null;
  const subtitleHostKey = manualMode
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

  const subtitleNode = host
    ? t.rich(subtitleHostKey, {
        host: (chunks) => <code className="font-mono">{chunks}</code>,
        hostName: host,
      })
    : t(subtitleHostKey);

  return (
    <div className="flex flex-col gap-10">
      <OnboardingPageHeader
        phase="confirm"
        title={t('heroTitle')}
        subtitle={subtitleNode}
        secondary={
          showRegenerate ? (
            <button
              type="button"
              onClick={handleRegenerateClick}
              disabled={regenerateDisabled}
              title={tRegen('tooltip')}
              className="text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground disabled:opacity-50"
            >
              {tRegen('topLink')}
            </button>
          ) : null
        }
      />
      {showConfirmReplace ? (
        <div className="-mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
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

      {isFetching || isSuggesting ? (
        <StageLoading status={data?.status ?? null} host={data?.domain ?? null} />
      ) : (
        <>
          {isFailed && errorCopy ? (
            <div
              role="status"
              className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm"
            >
              <p className="font-medium">{errorCopy}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('failedNotice.body')}</p>
            </div>
          ) : null}

          <BrandCard
            brandName={brandName}
            aliases={aliases}
            aliasSource={aliasSeed?.source ?? 'empty'}
            onBrandNameChange={setBrandName}
            onAliasesChange={(next) => {
              setAliases(next);
              setAliasesTouched(true);
            }}
            host={data?.domain ?? null}
          />

          <CompetitorsCard
            noEngine={Boolean(manualMode && !data?.suggestedCompetitors)}
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
            initiallyExpanded={
              Boolean(manualMode && !data?.suggestedCompetitors) ||
              data?.error?.stage === 'competitors'
            }
            defaultSelectedCount={data?.suggestedCompetitors?.length ?? 0}
          />

          <PromptsCard
            noEngine={Boolean(manualMode && !data?.suggestedPrompts)}
            partialError={
              data?.error?.stage === 'prompts' ? tErrors(errorKeyFor(data?.error)) : null
            }
            prompts={editedPrompts ?? data?.suggestedPrompts ?? []}
            onPromptsChange={setEditedPrompts}
            choice={promptChoice}
            onChoiceChange={setPromptChoice}
            starterAvailable={Boolean(starter)}
            starterPromptCount={starterPrompts.data?.length ?? 0}
            revealDelay="motion-safe:delay-300"
            initiallyExpanded={
              Boolean(manualMode && !data?.suggestedPrompts) || data?.error?.stage === 'prompts'
            }
          />

          <div className="flex flex-wrap items-center justify-end gap-6">
            {showRegenerate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRegenerateClick}
                disabled={regenerateDisabled}
                title={tRegen('tooltip')}
                className="text-muted-foreground"
              >
                <RotateCcw
                  className={`mr-1.5 size-4 ${regenerating ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {regenerating ? tRegen('inflight') : tRegen('cta')}
              </Button>
            ) : null}
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
