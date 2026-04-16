'use client';

import { Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { testWebhook } from '../../integrations.api';

interface TestWebhookButtonProps {
  webhookId: string;
  enabled: boolean;
}

export function TestWebhookButton({ webhookId, enabled }: TestWebhookButtonProps) {
  const t = useTranslations('settings');

  const mutation = useApiMutation<{ eventId: string }, string>({
    mutationFn: () => testWebhook(webhookId),
    successMessage: t('webhooks.testSuccess'),
  });

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutation.mutate(webhookId)}
      disabled={!enabled || mutation.isPending}
    >
      {mutation.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Send className="size-3.5" />
      )}
      {t('webhooks.test')}
    </Button>
  );

  if (!enabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- tabIndex needed for tooltip on disabled button (Radix UI pattern) */}
            <span tabIndex={0}>{button}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('webhooks.testDisabled')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
