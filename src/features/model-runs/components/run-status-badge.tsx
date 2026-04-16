'use client';

import { AlertTriangle, Ban, CheckCircle2, Loader2, SkipForward, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { ModelRunStatus, ModelRunResultStatus } from '../model-run.types';

interface RunStatusBadgeProps {
  status: ModelRunStatus | ModelRunResultStatus;
  size?: 'sm' | 'default';
  variant?: 'run' | 'result';
}

const statusConfig: Record<
  string,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
    icon: React.ElementType;
  }
> = {
  pending: {
    variant: 'secondary',
    icon: () => <span className="size-1.5 rounded-full bg-current" />,
  },
  running: {
    variant: 'default',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    icon: Loader2,
  },
  completed: {
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400',
    icon: CheckCircle2,
  },
  partial: {
    variant: 'default',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
  },
  failed: { variant: 'destructive', icon: XCircle },
  cancelled: { variant: 'outline', className: 'text-muted-foreground', icon: Ban },
  skipped: { variant: 'outline', className: 'text-muted-foreground', icon: SkipForward },
};

export function RunStatusBadge({ status, size = 'default', variant = 'run' }: RunStatusBadgeProps) {
  const t = useTranslations('modelRuns');

  const config = statusConfig[status];
  if (!config) {
    return <Badge variant="outline">{status}</Badge>;
  }

  const Icon = config.icon;
  const label =
    variant === 'run' ? t(`status.${status}` as never) : t(`resultStatus.${status}` as never);

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, size === 'sm' && 'h-4 px-1.5 text-[0.5625rem]')}
    >
      <Icon className={cn('size-3', status === 'running' && 'animate-spin')} />
      {label}
    </Badge>
  );
}
