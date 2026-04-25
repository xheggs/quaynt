'use client';

import { Activity } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { MonoChip } from '@/components/ui/mono-chip';
import { SectionCard } from '@/components/ui/section-card';
import { cn } from '@/lib/utils';
import type { PlatformStatus } from '../dashboard.types';

interface PlatformsSectionProps {
  platforms: PlatformStatus[] | null;
  className?: string;
}

const statusDot: Record<string, string> = {
  healthy: 'bg-success',
  degraded: 'bg-warning',
  unhealthy: 'bg-destructive',
};

const statusLabelKey: Record<
  string,
  'platforms.healthy' | 'platforms.degraded' | 'platforms.unhealthy'
> = {
  healthy: 'platforms.healthy',
  degraded: 'platforms.degraded',
  unhealthy: 'platforms.unhealthy',
};

export function PlatformsSection({ platforms, className }: PlatformsSectionProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <SectionCard
      index="03"
      title={t('sections.platforms')}
      indexLabel={t('sections.indexLabel', { index: '03' })}
      className={className}
    >
      {platforms === null ? (
        <ErrorState
          variant="inline"
          description={t('warnings.sectionFailed', { section: t('sections.platforms') })}
        />
      ) : platforms.length === 0 ? (
        <EmptyState variant="inline" icon={Activity} title={t('platforms.empty')} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="platforms-grid">
          {platforms.map((platform) => {
            const isDisabled = !platform.enabled;
            const status = isDisabled ? null : platform.lastHealthStatus;
            const dotClass = status ? statusDot[status] : 'bg-muted-foreground/40';
            const labelKey = status ? statusLabelKey[status] : null;
            const statusLabel = isDisabled ? null : labelKey ? t(labelKey) : t('platforms.unknown');

            return (
              <div
                key={platform.adapterId}
                className={cn('flex items-center gap-2.5', isDisabled && 'opacity-50')}
              >
                <span className={cn('size-2 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm text-foreground">{platform.displayName}</p>
                  {isDisabled ? (
                    <MonoChip tone="muted">{t('platforms.disabled')}</MonoChip>
                  ) : (
                    <MonoChip tone="muted">
                      {platform.lastHealthCheckedAt
                        ? `${statusLabel} · ${t('platforms.lastChecked', {
                            date: dateFormatter.format(new Date(platform.lastHealthCheckedAt)),
                          })}`
                        : statusLabel}
                    </MonoChip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
