'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { queryKeys } from '@/lib/query/keys';
import { fetchBrands, createBrand } from '@/features/brands';
import type { Brand } from '@/features/brands';
import { useUpdateOnboarding } from '@/features/onboarding';
import { ApiError } from '@/lib/query/types';

const MAX_COMPETITORS = 5;

type Row = { name: string; domain: string };

function emptyRow(): Row {
  return { name: '', domain: '' };
}

function findPrimaryBrand(brands: Brand[]): Brand | null {
  const primary = brands.find(
    (b) => !b.metadata || (b.metadata as Record<string, unknown>).role !== 'competitor'
  );
  return primary ?? brands[0] ?? null;
}

function findCompetitors(brands: Brand[]): Brand[] {
  return brands.filter((b) => (b.metadata as Record<string, unknown>)?.role === 'competitor');
}

type FormProps = {
  primary: Brand | null;
  initialRows: Row[];
};

function CompetitorsStepForm({ primary, initialRows }: FormProps) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();
  const update = useUpdateOnboarding();

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [submitting, setSubmitting] = useState(false);

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((prev) => (prev.length < MAX_COMPETITORS ? [...prev, emptyRow()] : prev));
  };

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [emptyRow()]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = rows.filter((r) => r.name.trim().length > 0);

    if (valid.length === 0) {
      update.mutate(
        { step: 'prompt_set' },
        { onSuccess: () => router.push(`/${locale}/onboarding/prompt-set`) }
      );
      return;
    }

    setSubmitting(true);
    try {
      const metadata: Record<string, unknown> = { role: 'competitor' };
      if (primary) metadata.competitorOf = primary.id;

      for (const row of valid) {
        await createBrand({
          name: row.name.trim(),
          domain: row.domain.trim() || undefined,
          metadata,
        });
      }
      update.mutate(
        { milestones: { competitorsAdded: true }, step: 'prompt_set' },
        { onSuccess: () => router.push(`/${locale}/onboarding/prompt-set`) }
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('errors.generic');
      toast.error(message);
      setSubmitting(false);
    }
  };

  const skip = () => {
    update.mutate(
      { step: 'prompt_set' },
      { onSuccess: () => router.push(`/${locale}/onboarding/prompt-set`) }
    );
  };

  const disabled = submitting || update.isPending;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('competitors.hero.title')}
        </h1>
        <p className="max-w-prose text-base text-muted-foreground">
          {t('competitors.hero.subtitle')}
        </p>
      </header>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <ul className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`competitor-name-${index}`} className="sr-only">
                  {t('competitors.fields.name.label')}
                </Label>
                <Input
                  id={`competitor-name-${index}`}
                  value={row.name}
                  onChange={(e) => updateRow(index, { name: e.target.value })}
                  placeholder={t('competitors.fields.name.placeholder')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`competitor-domain-${index}`} className="sr-only">
                  {t('competitors.fields.domain.label')}
                </Label>
                <Input
                  id={`competitor-domain-${index}`}
                  value={row.domain}
                  onChange={(e) => updateRow(index, { domain: e.target.value })}
                  placeholder={t('competitors.fields.domain.placeholder')}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(index)}
                aria-label={t('competitors.remove')}
                disabled={rows.length === 1 && !row.name && !row.domain}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={rows.length >= MAX_COMPETITORS}
          >
            {t('competitors.addAnother')}
          </Button>
          {rows.length >= MAX_COMPETITORS && (
            <p className="text-xs text-muted-foreground">{t('competitors.maxReached')}</p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={skip} disabled={disabled}>
            {t('wizard.skipStep')}
          </Button>
          <Button type="submit" disabled={disabled}>
            {t('wizard.continue')}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function CompetitorsStep() {
  const brandsQuery = useQuery({
    queryKey: queryKeys.brands.list({ page: 1, limit: 50 }),
    queryFn: () => fetchBrands({ page: 1, limit: 50 }),
    staleTime: 30_000,
  });

  const primary = useMemo(
    () => (brandsQuery.data ? findPrimaryBrand(brandsQuery.data.data) : null),
    [brandsQuery.data]
  );

  const initialRows = useMemo<Row[]>(() => {
    if (!brandsQuery.data) return [emptyRow()];
    const competitors = findCompetitors(brandsQuery.data.data).slice(0, MAX_COMPETITORS);
    if (competitors.length === 0) return [emptyRow()];
    return competitors.map((b) => ({ name: b.name, domain: b.domain ?? '' }));
  }, [brandsQuery.data]);

  if (brandsQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">…</p>;
  }

  return (
    <CompetitorsStepForm
      key={`competitors-${initialRows.length}`}
      primary={primary}
      initialRows={initialRows}
    />
  );
}
