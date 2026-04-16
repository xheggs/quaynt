'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | null;

interface AdapterHealthBadgeProps {
  status: HealthStatus;
}

const healthConfig: Record<
  string,
  {
    dotColor: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
    labelKey: string;
  }
> = {
  healthy: {
    dotColor: 'bg-green-500',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400',
    labelKey: 'adapters.health.healthy',
  },
  degraded: {
    dotColor: 'bg-amber-500',
    variant: 'default',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    labelKey: 'adapters.health.degraded',
  },
  unhealthy: {
    dotColor: 'bg-red-500',
    variant: 'destructive',
    labelKey: 'adapters.health.unhealthy',
  },
};

const unknownConfig = {
  dotColor: 'bg-muted-foreground',
  variant: 'secondary' as const,
  className: undefined as string | undefined,
  labelKey: 'adapters.health.unknown',
};

export function AdapterHealthBadge({ status }: AdapterHealthBadgeProps) {
  const t = useTranslations('settings');

  const config = status ? (healthConfig[status] ?? unknownConfig) : unknownConfig;

  return (
    <Badge variant={config.variant} className={config.className}>
      <span className={`size-2 shrink-0 rounded-full ${config.dotColor}`} aria-hidden="true" />
      {t(config.labelKey as never)}
    </Badge>
  );
}
