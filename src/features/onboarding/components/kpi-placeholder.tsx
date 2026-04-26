'use client';

import { useTranslations } from 'next-intl';
import { Loader2, Quote, ThumbsUp, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Kind = 'recommendation-share' | 'citation-count' | 'sentiment';

interface Props {
  kind: Kind;
  terminal: boolean;
  terminalKind: 'completed' | 'partial' | 'failed' | 'cancelled' | null;
  /** Earned-citation count derived from the streaming citations query. */
  earnedCount: number;
}

const icons: Record<Kind, React.ElementType> = {
  'recommendation-share': TrendingUp,
  'citation-count': Quote,
  sentiment: ThumbsUp,
};

const i18nKey: Record<Kind, 'share' | 'count' | 'sentiment'> = {
  'recommendation-share': 'share',
  'citation-count': 'count',
  sentiment: 'sentiment',
};

export function KpiPlaceholder({ kind, terminal, terminalKind, earnedCount }: Props) {
  const t = useTranslations('onboarding.firstRun.kpis');
  const slug = i18nKey[kind];
  const Icon = icons[kind];

  const isErrored = terminalKind === 'failed' || terminalKind === 'cancelled';
  const isEmptyTerminal = terminal && !isErrored && earnedCount === 0;
  const isLive = terminal && !isErrored && earnedCount > 0;

  let value: string | null = null;
  if (isLive && kind === 'citation-count') {
    value = String(earnedCount);
  }

  return (
    <Card aria-live="polite">
      <CardHeader className="flex flex-row items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <CardTitle className="text-sm">{t(`${slug}.title`)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">{t(`${slug}.description`)}</p>
        {isErrored ? (
          <p className="text-xs text-muted-foreground">{t(`${slug}.empty`)}</p>
        ) : isEmptyTerminal ? (
          <p className="text-xs text-muted-foreground">{t(`${slug}.empty`)}</p>
        ) : isLive ? (
          <p className="font-mono text-2xl font-semibold">{value ?? '—'}</p>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
            {t(`${slug}.computing`)}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
