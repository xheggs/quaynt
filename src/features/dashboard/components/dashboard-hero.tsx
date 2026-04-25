'use client';

import { useLocale, useTranslations } from 'next-intl';

import { AmbientBackdrop } from '@/components/layout/ambient-backdrop';
import { MonoChip } from '@/components/ui/mono-chip';

/**
 * Atmospheric hero band for the dashboard. Composes an `AmbientBackdrop`
 * with a glass-surface inner card carrying the page heading, subtitle and
 * a mono status strip ("now tracking · all sets · 4 brands · …").
 *
 * The hero owns the page's primary `<h1>`. The surrounding `dashboard-view`
 * should not render its own page heading.
 */
export type DashboardHeroProps = {
  /** Number of brands the workspace tracks. Falsy → omit the brands chip. */
  brandCount?: number;
  /** Number of prompt sets configured. Falsy → omit the prompt-sets chip. */
  promptSetCount?: number;
  /** Currently-selected prompt set name (or undefined for "all sets"). */
  promptSetName?: string;
  /** ISO timestamp of last data refresh. */
  dataAsOf?: string;
  /** When true, swaps the welcome title for the empty-workspace title. */
  empty?: boolean;
};

export function DashboardHero({
  brandCount,
  promptSetCount,
  promptSetName,
  dataAsOf,
  empty = false,
}: DashboardHeroProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });

  const showStatusStrip =
    !empty &&
    (typeof brandCount === 'number' || typeof promptSetCount === 'number' || Boolean(dataAsOf));

  return (
    <AmbientBackdrop density="band" className="rounded-md border border-border/60 overflow-hidden">
      <div className="p-6 md:p-10">
        {/* Overline strip */}
        <div className="flex items-center gap-2 mb-6">
          <MonoChip>{t('header.eyebrow')}</MonoChip>
          <span aria-hidden="true" className="font-mono text-[11px] text-muted-foreground/60">
            ·
          </span>
          <MonoChip tone="live" pulse={!empty}>
            {t('header.live')}
          </MonoChip>
        </div>

        {/* Inner glass panel */}
        <div className="glass-surface relative flex max-w-2xl flex-col gap-4 rounded-md p-6 md:p-8 animate-in fade-in slide-in-from-bottom-1 duration-500">
          <h1
            className="type-display text-foreground animate-in fade-in slide-in-from-bottom-1 duration-500"
            style={{ animationDelay: '0ms' }}
          >
            {t(empty ? 'header.emptyWelcome' : 'header.welcome')}
          </h1>

          <p
            className="text-base leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-500"
            style={{ animationDelay: '80ms' }}
          >
            {t(empty ? 'header.emptySubtitle' : 'header.subtitle')}
          </p>

          {showStatusStrip && (
            <div
              className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-1 duration-500"
              style={{ animationDelay: '160ms' }}
            >
              <span aria-hidden="true" className="block h-px w-12 bg-border" />
              <div className="flex flex-wrap items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <MonoChip tone="muted">{t('header.tracking')}</MonoChip>

                <span aria-hidden="true">·</span>
                <MonoChip tone={promptSetName ? 'live' : 'muted'}>
                  {promptSetName ?? t('filters.promptSetPlaceholder')}
                </MonoChip>

                {typeof brandCount === 'number' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <MonoChip tone="muted">{t('header.brands', { count: brandCount })}</MonoChip>
                  </>
                )}

                {typeof promptSetCount === 'number' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <MonoChip tone="muted">
                      {t('header.promptSets', { count: promptSetCount })}
                    </MonoChip>
                  </>
                )}

                {dataAsOf && (
                  <>
                    <span aria-hidden="true">·</span>
                    <MonoChip tone="muted">
                      {t('header.updatedAt', {
                        date: timeFormatter.format(new Date(dataAsOf)),
                      })}
                    </MonoChip>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AmbientBackdrop>
  );
}
