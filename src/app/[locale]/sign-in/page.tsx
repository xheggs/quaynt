'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from 'lucide-react';

import { authClient } from '@/modules/auth/auth.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';

type PageState = 'form' | 'sent';

const ENGINES = ['ChatGPT', 'Perplexity', 'Gemini', 'Claude', 'Copilot'];

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();

  const urlError = searchParams.get('error');
  const urlEmail = searchParams.get('email');

  const [email, setEmail] = useState(urlEmail ?? '');
  const [state, setState] = useState<PageState>('form');
  const [error, setError] = useState(urlError ? t('common.auth.magicLinkExpired') : '');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendMagicLink = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: `/${locale}/dashboard`,
      });

      if (result.error) {
        setError(result.error.message ?? t('common.auth.magicLinkFailed'));
      } else {
        setState('sent');
        setCooldown(60);
      }
    } catch {
      setError(t('common.auth.magicLinkFailed'));
    } finally {
      setLoading(false);
    }
  }, [email, locale, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMagicLink();
  };

  const handleResend = async () => {
    setCooldown(60);
    await sendMagicLink();
  };

  const handleReset = () => {
    setError('');
    setState('form');
    setCooldown(0);
  };

  const link = (chunks: ReactNode) => (
    <button
      type="button"
      className="underline underline-offset-4 transition-colors hover:text-foreground"
    >
      {chunks}
    </button>
  );

  return (
    <main className="relative grid min-h-screen grid-cols-1 bg-background md:grid-cols-2">
      <BrandPanel
        tagline={t('common.auth.tagline')}
        trackerLabel={t('common.auth.trackerLabel')}
        osBadge={t('common.auth.osBadge')}
      />

      <section className="relative flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-6 pt-6 md:hidden">
          <Logo width={96} height={24} />
          <ThemeToggle />
        </div>

        <div className="absolute right-8 top-8 z-10 hidden md:block">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center px-6 py-12 sm:px-10 md:px-16 md:py-16 lg:px-20">
          <div className="w-full max-w-[360px]">
            {state === 'form' ? (
              <form key="form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-7">
                <header className="flex animate-in flex-col gap-2 fade-in slide-in-from-bottom-1 duration-500">
                  <span className="type-overline text-muted-foreground">
                    {t('common.auth.eyebrow')}
                  </span>
                  <h1 className="type-page text-foreground">{t('common.auth.signInTitle')}</h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t('common.auth.signInSubtitle')}
                  </p>
                </header>

                <div
                  className="flex animate-in flex-col gap-2 fade-in slide-in-from-bottom-1 duration-500"
                  style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}
                >
                  <Label htmlFor="email" className="text-foreground">
                    {t('common.auth.email')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-11"
                  />
                </div>

                {error && <ErrorChip message={error} />}

                <div
                  className="flex animate-in flex-col gap-4 fade-in slide-in-from-bottom-1 duration-500"
                  style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}
                >
                  <Button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    className="h-11 w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        <span>{t('common.auth.sendMagicLink')}</span>
                      </>
                    ) : (
                      t('common.auth.sendMagicLink')
                    )}
                  </Button>

                  <div className="border-t border-border/60 pt-4">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t.rich('common.auth.legalLine', { terms: link, privacy: link })}
                    </p>
                  </div>
                </div>
              </form>
            ) : (
              <div key="sent" className="flex flex-col gap-7">
                <header className="flex animate-in flex-col gap-4 fade-in slide-in-from-bottom-1 duration-500">
                  <div
                    aria-hidden="true"
                    className="flex size-10 items-center justify-center rounded-md border border-border bg-muted/40"
                  >
                    <MailCheck className="size-5 text-foreground" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="type-overline text-muted-foreground">
                      {t('common.auth.eyebrow')}
                    </span>
                    <h1 className="type-page text-foreground">{t('common.auth.sentTitle')}</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t.rich('common.auth.sentSubtitle', {
                        email,
                        strong: (chunks) => (
                          <strong className="font-medium text-foreground">{chunks}</strong>
                        ),
                      })}
                    </p>
                  </div>
                </header>

                {error && <ErrorChip message={error} />}

                <p className="type-caption text-muted-foreground">{t('common.auth.checkSpam')}</p>

                <div
                  className="flex animate-in gap-3 fade-in slide-in-from-bottom-1 duration-500"
                  style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    className="h-10 flex-1"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    <span>{t('common.auth.useDifferentEmail')}</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleResend}
                    disabled={loading || cooldown > 0}
                    aria-busy={loading}
                    className="h-10 flex-1"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : cooldown > 0 ? (
                      t('common.auth.resendLinkCooldown', { seconds: cooldown })
                    ) : (
                      t('common.auth.resendLink')
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function ErrorChip({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex animate-in items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive fade-in slide-in-from-bottom-1 duration-300"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

type BrandPanelProps = {
  tagline: string;
  trackerLabel: string;
  osBadge: string;
};

function BrandPanel({ tagline, trackerLabel, osBadge }: BrandPanelProps) {
  const wrapRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    if (rafRef.current !== null) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${clientX - rect.left}px`);
      el.style.setProperty('--my', `${clientY - rect.top}px`);
      el.dataset.idle = 'false';
    });
  }, []);

  const handleLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (wrapRef.current) wrapRef.current.dataset.idle = 'true';
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <aside
      ref={wrapRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      data-idle="true"
      className="dot-grid dot-grid-wrap relative hidden flex-col justify-between border-r border-border bg-muted/40 p-10 dark:bg-card md:flex"
    >
      <div aria-hidden="true" className="dot-grid-glow" />

      <div className="relative flex items-center justify-between">
        <Logo width={110} height={28} />
      </div>

      <div className="glass-surface relative flex max-w-[440px] flex-col gap-8 rounded-md p-6">
        <h2 className="type-display text-foreground">{tagline}</h2>

        <div className="flex flex-col gap-3">
          <span aria-hidden="true" className="block h-px w-16 bg-border" />
          <div className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <span>{trackerLabel}</span>
            <span aria-hidden="true">·</span>
            <EngineCycler />
          </div>
        </div>
      </div>

      <div className="relative font-mono text-[11px] tracking-[0.04em] text-muted-foreground/80">
        {osBadge}
      </div>
    </aside>
  );
}

function EngineCycler() {
  const widest = ENGINES.reduce((a, b) => (b.length > a.length ? b : a), '');
  const slotSeconds = 3.5;
  const cycleSeconds = ENGINES.length * slotSeconds;
  return (
    <span className="relative inline-block text-foreground" aria-label={ENGINES.join(', ')}>
      <span aria-hidden="true" className="invisible">
        {widest}
      </span>
      {ENGINES.map((engine, i) => (
        <span
          key={engine}
          aria-hidden="true"
          className="engine-cycle absolute inset-0 opacity-0"
          style={{
            animationDelay: `${i * slotSeconds}s`,
            animationDuration: `${cycleSeconds}s`,
          }}
        >
          {engine}
        </span>
      ))}
    </span>
  );
}
