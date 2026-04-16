'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/error-state';
import { cn } from '@/lib/utils';
import type { PlatformStatus } from '../dashboard.types';

interface PlatformsSectionProps {
  platforms: PlatformStatus[] | null;
}

const statusConfig: Record<string, { dot: string; labelKey: string }> = {
  healthy: { dot: 'bg-emerald-500', labelKey: 'platforms.healthy' },
  degraded: { dot: 'bg-amber-500', labelKey: 'platforms.degraded' },
  unhealthy: { dot: 'bg-red-500', labelKey: 'platforms.unhealthy' },
};

export function PlatformsSection({ platforms }: PlatformsSectionProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-section">{t('sections.platforms')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 px-4 pb-4">
        {platforms === null ? (
          <ErrorState
            variant="inline"
            description={t('warnings.sectionFailed', { section: t('sections.platforms') })}
          />
        ) : platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('platforms.empty')}</p>
        ) : (
          <div
            className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
            data-testid="platforms-grid"
          >
            {platforms.map((platform) => {
              const isDisabled = !platform.enabled;
              const status = isDisabled ? null : platform.lastHealthStatus;
              const config = status ? statusConfig[status] : null;

              return (
                <div
                  key={platform.adapterId}
                  className={cn('flex items-center gap-2.5', isDisabled && 'opacity-50')}
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      config?.dot ?? 'bg-muted-foreground/50'
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{platform.displayName}</p>
                    <p className="type-caption text-muted-foreground">
                      {isDisabled
                        ? t('platforms.disabled')
                        : config
                          ? t(config.labelKey as 'platforms.healthy')
                          : t('platforms.unknown')}
                      {platform.lastHealthCheckedAt && !isDisabled && (
                        <>
                          {' '}
                          &middot;{' '}
                          {t('platforms.lastChecked', {
                            date: dateFormatter.format(new Date(platform.lastHealthCheckedAt)),
                          })}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
