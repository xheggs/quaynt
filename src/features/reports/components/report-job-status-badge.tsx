'use client';

import { Check, Clock, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { ReportJobStatus } from '../reports.types';

const statusConfig: Record<
  ReportJobStatus,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
    icon: React.ElementType;
  }
> = {
  pending: { variant: 'outline', icon: Clock },
  processing: {
    variant: 'default',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    icon: Loader2,
  },
  completed: {
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400',
    icon: Check,
  },
  failed: { variant: 'destructive', icon: X },
};

interface ReportJobStatusBadgeProps {
  status: ReportJobStatus;
}

export function ReportJobStatusBadge({ status }: ReportJobStatusBadgeProps) {
  const t = useTranslations('reports');

  const config = statusConfig[status];
  if (!config) {
    return <Badge variant="outline">{status}</Badge>;
  }

  const Icon = config.icon;
  const label = t(`job.status.${status}` as never);

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      <Icon className={cn('size-3', status === 'processing' && 'animate-spin')} />
      {label}
    </Badge>
  );
}
