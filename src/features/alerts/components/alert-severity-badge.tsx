'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { AlertSeverity } from '../alerts.types';

const severityConfig: Record<
  AlertSeverity,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
    icon: React.ElementType;
  }
> = {
  critical: {
    variant: 'destructive',
    icon: AlertTriangle,
  },
  warning: {
    variant: 'default',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
  },
  info: {
    variant: 'secondary',
    icon: Info,
  },
};

interface AlertSeverityBadgeProps {
  severity: AlertSeverity;
  size?: 'sm' | 'default';
}

export function AlertSeverityBadge({ severity, size = 'default' }: AlertSeverityBadgeProps) {
  const t = useTranslations('alerts');

  const config = severityConfig[severity];
  if (!config) {
    return <Badge variant="outline">{severity}</Badge>;
  }

  const Icon = config.icon;
  const label = t(`severity.${severity}` as never);

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, size === 'sm' && 'h-4 px-1.5 text-[0.5625rem]')}
    >
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
