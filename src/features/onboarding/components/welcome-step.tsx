'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorChip } from '@/components/ui/error-chip';
import { Cycler } from '@/components/brand/cycler';
import { useCreateSuggestion } from '@/features/onboarding/hooks/use-suggestion';
import { ApiError } from '@/lib/query/types';
import { OnboardingPageHeader } from './onboarding-page-header';

export function WelcomeStep() {
  const t = useTranslations('onboarding');
  const tErrors = useTranslations('onboarding.errors');
  const locale = useLocale();
  const router = useRouter();
  const createSuggestion = useCreateSuggestion();

  const inputRef = useRef<HTMLInputElement>(null);
  const [domain, setDomain] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isPending = createSuggestion.isPending;
  // next-intl returns strings from `t()` — use `t.raw` to read array messages.
  const promiseItems = t.raw('domain.promise.items') as string[];

  async function handleContinue() {
    setDomainError(null);
    const trimmed = domain.trim();
    if (!trimmed) {
      setDomainError(t('domain.field.invalid'));
      return;
    }

    try {
      const result = await createSuggestion.mutateAsync(trimmed);
      router.push(`/${locale}/onboarding/review/${encodeURIComponent(result.id)}`);
    } catch (e) {
      if (e instanceof ApiError && e.details && typeof e.details === 'object') {
        const details = e.details as unknown as { code?: string; field?: string };
        if (details.field === 'domain') {
          setDomainError(t('domain.field.invalid'));
          return;
        }
      }
      toast.error(tErrors('generic'));
    }
  }

  return (
    <div className="relative flex flex-col items-stretch gap-10 pt-6 sm:pt-10">
      <div
        aria-hidden="true"
        className="dot-grid-band pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      <OnboardingPageHeader
        phase="connect"
        title={t('domain.hero.title')}
        subtitle={t('domain.hero.subtitle')}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleContinue();
        }}
        className="flex animate-in flex-col gap-3 fade-in slide-in-from-bottom-1 duration-500"
        style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}
        noValidate
      >
        <Label htmlFor="onboarding-domain" className="sr-only">
          {t('domain.field.label')}
        </Label>
        <Input
          ref={inputRef}
          id="onboarding-domain"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder={t('domain.field.placeholder')}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          aria-invalid={domainError ? true : undefined}
          aria-describedby={domainError ? 'onboarding-domain-error' : 'onboarding-domain-help'}
          disabled={isPending}
          className="h-11"
        />

        <div className="min-h-[1.75rem]">
          {domainError ? (
            <ErrorChip message={domainError} />
          ) : (
            <p
              id="onboarding-domain-help"
              className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              <span aria-hidden="true">{t('domain.promise.label')}</span>
              <span aria-hidden="true">·</span>
              <Cycler items={promiseItems} ariaLabel={t('domain.promise.aria')} />
            </p>
          )}
        </div>

        <div
          className="flex animate-in flex-col gap-4 pt-2 fade-in slide-in-from-bottom-1 duration-500"
          style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}
        >
          <Button type="submit" disabled={isPending} className="h-11 w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {t('domain.cta.pending')}
              </>
            ) : (
              t('domain.cta.idle')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
