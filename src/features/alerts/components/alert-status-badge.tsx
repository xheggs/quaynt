'use client';

import { Check, Clock, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { AlertEventStatus } from '../alerts.types';

const statusConfig: Record<
  AlertEventStatus,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
    icon: React.ElementType;
  }
> = {
  active: {
    variant: 'destructive',
    icon: AlertCircle,
  },
  acknowledged: {
    variant: 'secondary',
    className: 'text-muted-foreground',
    icon: Check,
  },
  snoozed: {
    variant: 'outline',
    className: 'text-muted-foreground',
    icon: Clock,
  },
};

interface AlertStatusBadgeProps {
  status: AlertEventStatus;
  size?: 'sm' | 'default';
}

export function AlertStatusBadge({ status, size = 'default' }: AlertStatusBadgeProps) {
  const t = useTranslations('alerts');

  const config = statusConfig[status];
  if (!config) {
    return <Badge variant="outline">{status}</Badge>;
  }

  const Icon = config.icon;
  const label = t(`management.status.${status}` as never);

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
