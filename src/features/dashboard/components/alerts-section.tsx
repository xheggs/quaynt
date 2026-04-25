'use client';

import { AlertTriangle, ArrowRight, Bell, Info } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Badge } from '@/components/ui/badge';
import { MonoChip, type MonoChipTone } from '@/components/ui/mono-chip';
import { SectionCard } from '@/components/ui/section-card';
import { cn } from '@/lib/utils';
import type { DashboardAlertSummary } from '../dashboard.types';

interface AlertsSectionProps {
  alerts: DashboardAlertSummary | null;
  className?: string;
}

const severityIcon = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
} as const;

const severityColor = {
  critical: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground',
} as const;

const severityTone: Record<'critical' | 'warning' | 'info', MonoChipTone> = {
  critical: 'destructive',
  warning: 'warning',
  info: 'muted',
};

export function AlertsSection({ alerts, className }: AlertsSectionProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });

  const action =
    alerts && alerts.active > 0 ? (
      <Badge variant={alerts.bySeverity.critical > 0 ? 'destructive' : 'secondary'}>
        {t('alerts.active', { count: alerts.active })}
      </Badge>
    ) : null;

  const footer = (
    <Link
      href={`/${locale}/alerts?tab=events`}
      className="inline-flex items-center gap-1 font-mono type-overline text-primary hover:text-primary-hover"
    >
      {t('alerts.viewAll')}
      <ArrowRight className="size-3" aria-hidden="true" />
    </Link>
  );

  return (
    <SectionCard
      index="04"
      title={t('sections.alerts')}
      indexLabel={t('sections.indexLabel', { index: '04' })}
      className={className}
      action={action}
      footer={footer}
    >
      {alerts === null ? (
        <ErrorState
          variant="inline"
          description={t('warnings.sectionFailed', { section: t('sections.alerts') })}
        />
      ) : alerts.total === 0 && alerts.recentEvents.length === 0 ? (
        <EmptyState variant="inline" icon={Bell} title={t('alerts.empty')} />
      ) : (
        <div className="space-y-4">
          <div className="flex gap-6" data-testid="alert-severity-summary">
            {(['critical', 'warning', 'info'] as const).map((severity) => (
              <div key={severity} className="flex flex-col gap-1">
                <span className="type-section text-foreground tabular-nums">
                  {alerts.bySeverity[severity]}
                </span>
                <MonoChip tone={severityTone[severity]}>{t(`alerts.${severity}`)}</MonoChip>
              </div>
            ))}
          </div>
          {alerts.recentEvents.length > 0 && (
            <ul className="divide-y divide-border" data-testid="alert-events-list">
              {alerts.recentEvents.slice(0, 5).map((event) => {
                const severity = (event.severity as 'critical' | 'warning' | 'info') ?? 'info';
                const SeverityIcon = severityIcon[severity] ?? Info;
                const color = severityColor[severity] ?? severityColor.info;

                return (
                  <li key={event.id} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                    <SeverityIcon
                      className={cn('mt-0.5 size-3.5 shrink-0', color)}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-foreground">{event.message}</p>
                      <MonoChip tone="muted">
                        {dateFormatter.format(new Date(event.triggeredAt))}
                      </MonoChip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  );
}
