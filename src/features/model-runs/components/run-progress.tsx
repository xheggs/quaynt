'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { ResultSummary } from '../model-run.types';

interface RunProgressProps {
  resultSummary: ResultSummary;
  variant?: 'compact' | 'full';
}

export function RunProgress({ resultSummary, variant = 'compact' }: RunProgressProps) {
  const t = useTranslations('modelRuns');

  const { total, completed, failed, skipped, pending, running } = resultSummary;
  const done = completed + failed + skipped;
  const progressPercent = total > 0 ? (done / total) * 100 : 0;

  const barHeight = variant === 'compact' ? 'h-1' : 'h-2';

  return (
    <div className="space-y-1">
      {/* Progress bar */}
      <div
        className={cn('w-full overflow-hidden rounded-full bg-muted', barHeight)}
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={t('progress.label')}
      >
        <div className="flex h-full">
          {total > 0 && completed > 0 && (
            <div
              className="bg-green-500 dark:bg-green-400"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          )}
          {total > 0 && failed > 0 && (
            <div className="bg-destructive" style={{ width: `${(failed / total) * 100}%` }} />
          )}
          {total > 0 && skipped > 0 && (
            <div
              className="bg-muted-foreground/30"
              style={{ width: `${(skipped / total) * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Text below bar */}
      {variant === 'compact' ? (
        <p className="type-caption text-muted-foreground">
          {t('progress.fraction', { done, total })}
        </p>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 type-caption text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-green-500 dark:bg-green-400" />
              {t('progress.completed', { count: completed })}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-destructive" />
              {t('progress.failed', { count: failed })}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-muted-foreground/30" />
              {t('progress.skipped', { count: skipped })}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-blue-500" />
              {t('progress.running', { count: running })}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              {t('progress.pending', { count: pending })}
            </span>
          </div>
          <span className="text-sm font-medium">
            {t('progress.percent', { value: Math.round(progressPercent) })}
          </span>
        </div>
      )}
    </div>
  );
}
