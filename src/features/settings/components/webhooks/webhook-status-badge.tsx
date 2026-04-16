'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { WebhookEndpoint } from '../../integrations.types';

interface WebhookStatusBadgeProps {
  endpoint: WebhookEndpoint;
}

type WebhookStatus = 'active' | 'disabled' | 'failing';

function deriveStatus(endpoint: WebhookEndpoint): WebhookStatus {
  if (!endpoint.enabled && endpoint.disabledReason) return 'failing';
  if (!endpoint.enabled) return 'disabled';
  return 'active';
}

const statusConfig: Record<
  WebhookStatus,
  {
    dotColor: string;
    variant: 'default' | 'secondary' | 'destructive';
    className?: string;
    labelKey: string;
  }
> = {
  active: {
    dotColor: 'bg-green-500',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400',
    labelKey: 'webhooks.status.active',
  },
  disabled: {
    dotColor: 'bg-muted-foreground',
    variant: 'secondary',
    labelKey: 'webhooks.status.disabled',
  },
  failing: {
    dotColor: 'bg-red-500',
    variant: 'destructive',
    labelKey: 'webhooks.status.failing',
  },
};

export function WebhookStatusBadge({ endpoint }: WebhookStatusBadgeProps) {
  const t = useTranslations('settings');
  const status = deriveStatus(endpoint);
  const config = statusConfig[status];

  const badge = (
    <Badge variant={config.variant} className={config.className}>
      <span className={`size-2 shrink-0 rounded-full ${config.dotColor}`} aria-hidden="true" />
      {t(config.labelKey as never)}
    </Badge>
  );

  if (status === 'failing' && endpoint.disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-[280px]">
            <p>{endpoint.disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
