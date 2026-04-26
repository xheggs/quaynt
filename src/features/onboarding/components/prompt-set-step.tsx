'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query/keys';
import { fetchBrands } from '@/features/brands';
import { fetchPromptSets, fetchPrompts } from '@/features/prompt-sets';
import { createModelRun } from '@/features/model-runs';
import { fetchAdapters } from '@/features/settings';
import { useUpdateOnboarding } from '@/features/onboarding';
import { ApiError } from '@/lib/query/types';

type Choice = 'starter' | 'skip' | null;

const STARTER_NAME = 'Quaynt Starter';

export function PromptSetStep() {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();
  const update = useUpdateOnboarding();

  const promptSets = useQuery({
    queryKey: queryKeys.promptSets.list({ page: 1, limit: 50 }),
    queryFn: () => fetchPromptSets({ page: 1, limit: 50 }),
    staleTime: 30_000,
  });

  const adapters = useQuery({
    queryKey: queryKeys.adapters.list({ page: 1, limit: 50 }),
    queryFn: () => fetchAdapters({ page: 1, limit: 50 }),
    staleTime: 30_000,
  });

  const brands = useQuery({
    queryKey: queryKeys.brands.list({ page: 1, limit: 50 }),
    queryFn: () => fetchBrands({ page: 1, limit: 50 }),
    staleTime: 30_000,
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

  const enabledAdapters = useMemo(
    () => adapters.data?.data.filter((a) => a.enabled && a.credentialsSet && !a.deletedAt) ?? [],
    [adapters.data]
  );

  const primaryBrand = useMemo(() => {
    if (!brands.data) return null;
    const items = brands.data.data;
    const primary = items.find(
      (b) => !b.metadata || (b.metadata as Record<string, unknown>).role !== 'competitor'
    );
    return primary ?? items[0] ?? null;
  }, [brands.data]);

  const [choice, setChoice] = useState<Choice>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRun = async () => {
    if (!starter || !primaryBrand || enabledAdapters.length === 0) return;
    setSubmitting(true);
    try {
      const run = await createModelRun({
        promptSetId: starter.id,
        brandId: primaryBrand.id,
        adapterConfigIds: enabledAdapters.map((a) => a.id),
        locale,
      });
      update.mutate(
        {
          milestones: { promptSetSelected: true, firstRunTriggered: true },
          step: 'first_run',
        },
        {
          onSuccess: () => {
            toast.success(t('promptSet.runConfirmToast'));
            router.push(`/${locale}/onboarding/first-run/${run.id}`);
          },
        }
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('errors.generic');
      toast.error(message);
      setSubmitting(false);
    }
  };

  const handleSkipChoice = () => {
    update.mutate(
      { step: 'first_run' },
      {
        onSuccess: () => router.push(`/${locale}/dashboard`),
      }
    );
  };

  const adapterMissing = enabledAdapters.length === 0;
  const disabled = submitting || update.isPending;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('promptSet.hero.title')}
        </h1>
        <p className="max-w-prose text-base text-muted-foreground">
          {t('promptSet.hero.subtitle')}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          aria-pressed={choice === 'starter'}
          className={cn(
            'cursor-pointer transition-all',
            choice === 'starter' ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/40'
          )}
          onClick={() => setChoice('starter')}
        >
          <CardHeader>
            <span className="text-xs font-medium uppercase tracking-wide text-primary">
              {t('promptSet.starterRecommended')}
            </span>
            <CardTitle>{t('promptSet.starterTitle')}</CardTitle>
            <CardDescription>{t('promptSet.starterDescription')}</CardDescription>
          </CardHeader>
        </Card>
        <Card
          aria-pressed={choice === 'skip'}
          className={cn(
            'cursor-pointer border-dashed transition-all',
            choice === 'skip' ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/40'
          )}
          onClick={() => setChoice('skip')}
        >
          <CardHeader>
            <CardTitle>{t('promptSet.skipTitle')}</CardTitle>
            <CardDescription>{t('promptSet.skipDescription')}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {choice === 'starter' && starterPrompts.data && (
        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              aria-expanded={previewOpen}
              className="flex items-center justify-between text-sm font-medium"
            >
              <span>{t('promptSet.previewToggle')}</span>
              {previewOpen ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
            </button>
          </CardHeader>
          {previewOpen && (
            <CardContent>
              <p className="mb-2 text-xs text-muted-foreground">{t('promptSet.previewHint')}</p>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
                {starterPrompts.data.map((p) => (
                  <li key={p.id} className="font-mono text-xs">
                    {p.template}
                  </li>
                ))}
              </ol>
            </CardContent>
          )}
        </Card>
      )}

      {choice === 'starter' && adapterMissing && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600" aria-hidden="true" />
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{t('promptSet.noAdapter.title')}</p>
              <p className="text-xs text-muted-foreground">{t('promptSet.noAdapter.body')}</p>
              <Link
                href={`/${locale}/settings?return=onboarding/prompt-set`}
                className="text-xs font-medium underline"
              >
                {t('promptSet.noAdapter.cta')}
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        {choice === 'skip' && (
          <Button type="button" onClick={handleSkipChoice} disabled={disabled}>
            {t('wizard.continue')}
          </Button>
        )}
        {choice === 'starter' && !adapterMissing && (
          <Button
            type="button"
            onClick={handleRun}
            disabled={disabled || !starter || !primaryBrand}
          >
            {submitting ? t('promptSet.runRunning') : t('promptSet.runCta')}
          </Button>
        )}
      </div>
    </div>
  );
}
