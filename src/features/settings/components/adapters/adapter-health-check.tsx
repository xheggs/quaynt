'use client';

import { Activity, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { AdapterHealthResult } from '../../integrations.types';
import { SERP_ADAPTER_PLATFORMS } from '../../integrations.types';
import { checkAdapterHealth } from '../../integrations.api';

interface AdapterHealthCheckProps {
  adapterId: string;
  platformId: string;
}

export function AdapterHealthCheck({ adapterId, platformId }: AdapterHealthCheckProps) {
  const t = useTranslations('settings');

  const isSerpAdapter = (SERP_ADAPTER_PLATFORMS as readonly string[]).includes(platformId);

  const mutation = useApiMutation<AdapterHealthResult, string>({
    mutationFn: () => checkAdapterHealth(adapterId),
    invalidateKeys: [queryKeys.adapters.detail(adapterId), queryKeys.adapters.lists()],
    successMessage: undefined,
    onSuccess: (data) => {
      // Toast with health status is shown via the mutation success
      // The badge will update from query invalidation
      void data;
    },
  });

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutation.mutate(adapterId)}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Activity className="size-3.5" />
      )}
      {mutation.isPending ? t('adapters.health.checking') : t('adapters.health.check')}
    </Button>
  );

  if (isSerpAdapter) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent className="max-w-[280px]">
            <p>{t('adapters.health.costWarning')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
