'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { SuggestionStatus } from '../../api/suggest';

const ELAPSED_HINT_DELAY_MS = 6_000;

type Props = {
  status: SuggestionStatus | null;
  host: string | null;
};

export function StageLoading({ status, host }: Props) {
  const t = useTranslations('onboarding.review.loading');
  const [showElapsedHint, setShowElapsedHint] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowElapsedHint(true), ELAPSED_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const isSuggesting = status === 'suggesting';
  const headline = isSuggesting
    ? t('suggesting')
    : host
      ? t.rich('fetching', {
          host: (chunks) => <code className="font-mono">{chunks}</code>,
          hostName: host,
        })
      : t('fetchingNoHost');

  return (
    <Card role="status" aria-live="polite" aria-label={t('ariaLabel')} className="border-border/60">
      <CardContent className="flex flex-col gap-3 py-8">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 size-5 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
          <p className="text-balance text-sm font-medium leading-snug text-foreground sm:text-base">
            {headline}
          </p>
        </div>
        <p
          className={`pl-8 text-xs text-muted-foreground motion-safe:transition-opacity motion-safe:duration-300 ${
            showElapsedHint ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {t('elapsedHint')}
        </p>
      </CardContent>
    </Card>
  );
}
