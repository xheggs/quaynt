'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { queryKeys } from '@/lib/query/keys';
import { fetchBrands, createBrand } from '@/features/brands';
import type { Brand } from '@/features/brands';
import { useWorkspaceQuery } from '@/features/settings';
import { useUpdateOnboarding } from '@/features/onboarding';
import { ApiError } from '@/lib/query/types';

const brandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  domain: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((v) => (v ? v.replace(/^https?:\/\//, '').replace(/\/$/, '') : v))
    .refine((v) => !v || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v), 'invalid'),
  aliases: z.string().optional(),
});

function stripWorkspaceSuffix(name?: string | null): string {
  if (!name) return '';
  return name.replace(/'s Workspace$/i, '').trim();
}

function findPrimaryBrand(brands: Brand[]): Brand | null {
  const primary = brands.find(
    (b) => !b.metadata || (b.metadata as Record<string, unknown>).role !== 'competitor'
  );
  return primary ?? brands[0] ?? null;
}

type FormProps = {
  existingBrand: Brand | null;
  workspaceName: string | null;
};

function BrandStepForm({ existingBrand, workspaceName }: FormProps) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const router = useRouter();
  const update = useUpdateOnboarding();

  const initialName = existingBrand ? existingBrand.name : stripWorkspaceSuffix(workspaceName);
  const initialDomain = existingBrand?.domain ?? '';
  const initialAliases = existingBrand ? existingBrand.aliases.join(', ') : '';

  const [name, setName] = useState(initialName);
  const [domain, setDomain] = useState(initialDomain);
  const [aliases, setAliases] = useState(initialAliases);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const parsed = brandSchema.safeParse({ name, domain, aliases });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]?.toString() ?? 'form';
        if (field === 'name') fieldErrors.name = t('brand.errors.nameRequired');
        else if (field === 'domain') fieldErrors.domain = t('brand.errors.domainInvalid');
      }
      setErrors(fieldErrors);
      return;
    }

    const aliasesList = parsed.data.aliases
      ? parsed.data.aliases
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (aliasesList.length > 10) {
      setErrors({ aliases: t('brand.errors.tooManyAliases') });
      return;
    }

    setSubmitting(true);
    try {
      if (!existingBrand) {
        await createBrand({
          name: parsed.data.name,
          domain: parsed.data.domain || undefined,
          aliases: aliasesList,
        });
      }
      update.mutate(
        { milestones: { brandAdded: true }, step: 'competitors' },
        { onSuccess: () => router.push(`/${locale}/onboarding/competitors`) }
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('errors.generic');
      toast.error(message);
      setSubmitting(false);
    }
  };

  const skip = () => {
    update.mutate(
      { step: 'competitors' },
      { onSuccess: () => router.push(`/${locale}/onboarding/competitors`) }
    );
  };

  const noticeShown = Boolean(existingBrand);
  const disabled = submitting || update.isPending;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('brand.hero.title')}
        </h1>
        <p className="max-w-prose text-base text-muted-foreground">{t('brand.hero.subtitle')}</p>
      </header>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {noticeShown && (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t('brand.alreadyExists')}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-name">{t('brand.fields.name.label')}</Label>
          <Input
            id="brand-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('brand.fields.name.placeholder')}
            aria-invalid={Boolean(errors.name)}
            aria-describedby="brand-name-help"
          />
          <p id="brand-name-help" className="text-xs text-muted-foreground">
            {errors.name ?? t('brand.fields.name.help')}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-domain">{t('brand.fields.domain.label')}</Label>
          <Input
            id="brand-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={t('brand.fields.domain.placeholder')}
            aria-invalid={Boolean(errors.domain)}
            aria-describedby="brand-domain-help"
          />
          <p id="brand-domain-help" className="text-xs text-muted-foreground">
            {errors.domain ?? t('brand.fields.domain.help')}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-aliases">{t('brand.fields.aliases.label')}</Label>
          <Input
            id="brand-aliases"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder={t('brand.fields.aliases.placeholder')}
            aria-invalid={Boolean(errors.aliases)}
            aria-describedby="brand-aliases-help"
          />
          <p id="brand-aliases-help" className="text-xs text-muted-foreground">
            {errors.aliases ?? t('brand.fields.aliases.help')}
          </p>
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

export function BrandStep() {
  const workspace = useWorkspaceQuery();

  const brandsQuery = useQuery({
    queryKey: queryKeys.brands.list({ page: 1, limit: 50 }),
    queryFn: () => fetchBrands({ page: 1, limit: 50 }),
    staleTime: 30_000,
  });

  const existingBrand = useMemo<Brand | null>(
    () => (brandsQuery.data ? findPrimaryBrand(brandsQuery.data.data) : null),
    [brandsQuery.data]
  );

  const ready = !brandsQuery.isLoading && !workspace.isLoading;

  if (!ready) {
    return <p className="py-10 text-center text-sm text-muted-foreground">…</p>;
  }

  return (
    <BrandStepForm
      key={existingBrand?.id ?? 'new'}
      existingBrand={existingBrand}
      workspaceName={workspace.data?.name ?? null}
    />
  );
}
