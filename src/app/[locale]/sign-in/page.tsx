'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { authClient } from '@/modules/auth/auth.client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PageState = 'form' | 'sent' | 'error';

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
  const [state, setState] = useState<PageState>(urlError ? 'error' : 'form');
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
    setEmail('');
    setError('');
    setState('form');
    setCooldown(0);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-6"
            >
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h1 className="type-section text-foreground">{t('common.appName')}</h1>
        </div>

        {/* Sign-in card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">
              {state === 'form' ? t('common.auth.signIn') : t('common.auth.checkEmail')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Future: SSO provider buttons + "or" divider */}

            {state === 'form' ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('common.auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? '...' : t('common.auth.sendMagicLink')}
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="size-6 text-muted-foreground"
                    >
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    {t('common.auth.magicLinkSent', { email })}
                  </p>
                  <p className="text-center text-xs text-muted-foreground/70">
                    {t('common.auth.checkSpam')}
                  </p>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  variant="outline"
                  onClick={handleResend}
                  disabled={loading || cooldown > 0}
                  className="w-full"
                >
                  {cooldown > 0
                    ? t('common.auth.resendLinkCooldown', { seconds: cooldown })
                    : t('common.auth.resendLink')}
                </Button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {t('common.auth.useDifferentEmail')}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
