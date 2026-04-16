'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import type { SentimentLabel } from '../citation.types';

const sentimentVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-medium',
  {
    variants: {
      sentiment: {
        positive: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        neutral: 'bg-muted text-muted-foreground',
        negative: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      },
    },
  }
);

const icons = {
  positive: TrendingUp,
  neutral: Minus,
  negative: TrendingDown,
} as const;

interface SentimentBadgeProps {
  sentiment: SentimentLabel | null;
  className?: string;
}

export function SentimentBadge({ sentiment, className }: SentimentBadgeProps) {
  const t = useTranslations('citations');

  if (!sentiment) {
    return <span className="text-muted-foreground">&mdash;</span>;
  }

  const Icon = icons[sentiment];
  const label = t(`sentiment.${sentiment}`);

  return (
    <span
      className={cn(sentimentVariants({ sentiment }), className)}
      aria-label={t('sentiment.ariaLabel', { sentiment: label })}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
