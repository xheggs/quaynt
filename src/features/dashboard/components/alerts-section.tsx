'use client';

import { AlertTriangle, ArrowRight, Bell, Info } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/error-state';
import { cn } from '@/lib/utils';
import type { DashboardAlertSummary } from '../dashboard.types';

interface AlertsSectionProps {
  alerts: DashboardAlertSummary | null;
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400' },
  warning: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  info: { icon: Info, color: 'text-muted-foreground' },
} as const;

export function AlertsSection({ alerts }: AlertsSectionProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Card className="col-span-12 md:col-span-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="type-section flex items-center gap-2">
            {t('sections.alerts')}
            {alerts && alerts.active > 0 && (
              <Badge variant={alerts.bySeverity.critical > 0 ? 'destructive' : 'secondary'}>
                {alerts.active}
              </Badge>
            )}
          </CardTitle>
          <Link
            href={`/${locale}/alerts?tab=events`}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
          >
            {t('alerts.viewAll')}
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0 px-5 pb-5">
        {alerts === null ? (
          <ErrorState
            variant="inline"
            description={t('warnings.sectionFailed', { section: t('sections.alerts') })}
          />
        ) : alerts.total === 0 && alerts.recentEvents.length === 0 ? (
          <EmptyState variant="inline" icon={Bell} title={t('alerts.empty')} />
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4" data-testid="alert-severity-summary">
              {(['critical', 'warning', 'info'] as const).map((severity) => (
                <div key={severity} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'text-lg font-semibold tabular-nums',
                      severityConfig[severity].color
                    )}
                  >
                    {alerts.bySeverity[severity]}
                  </span>
                  <span className="type-caption text-muted-foreground">
                    {t(`alerts.${severity}`)}
                  </span>
                </div>
              ))}
            </div>
            {alerts.recentEvents.length > 0 && (
              <ul className="divide-y divide-border" data-testid="alert-events-list">
                {alerts.recentEvents.slice(0, 5).map((event) => {
                  const config =
                    severityConfig[event.severity as keyof typeof severityConfig] ??
                    severityConfig.info;
                  const SeverityIcon = config.icon;

                  return (
                    <li key={event.id} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                      <SeverityIcon
                        className={cn('mt-0.5 size-3.5 shrink-0', config.color)}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm text-foreground">{event.message}</p>
                        <p className="type-caption text-muted-foreground">
                          {dateFormatter.format(new Date(event.triggeredAt))}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
