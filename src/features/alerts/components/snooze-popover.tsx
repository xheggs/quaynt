'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import type { AlertEvent } from '../alerts.types';
import { snoozeEvent } from '../alerts.api';

const SNOOZE_PRESETS = [
  { labelKey: 'snooze.presets.1h', duration: 3600 },
  { labelKey: 'snooze.presets.4h', duration: 14400 },
  { labelKey: 'snooze.presets.24h', duration: 86400 },
  { labelKey: 'snooze.presets.1w', duration: 604800 },
] as const;

interface SnoozePopoverProps {
  eventId: string;
  disabled?: boolean;
}

export function SnoozePopover({ eventId, disabled }: SnoozePopoverProps) {
  const t = useTranslations('alerts');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDateTime, setCustomDateTime] = useState('');

  const snoozeMutation = useApiMutation<AlertEvent, { duration?: number; snoozedUntil?: string }>({
    mutationFn: (input) => snoozeEvent(eventId, input),
    invalidateKeys: [queryKeys.alertEvents.lists()],
    onSuccess: (data) => {
      const snoozedUntil = data.snoozedUntil;
      if (snoozedUntil) {
        const formatted = new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(snoozedUntil));
        // The success message is shown via the toast in useApiMutation
        void formatted;
      }
      setOpen(false);
      setShowCustom(false);
      setCustomDateTime('');
    },
  });

  function handlePresetSnooze(duration: number) {
    snoozeMutation.mutate({ duration });
  }

  function handleCustomSnooze() {
    if (!customDateTime) return;
    const date = new Date(customDateTime);
    snoozeMutation.mutate({ snoozedUntil: date.toISOString() });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setShowCustom(false);
          setCustomDateTime('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={disabled}
          aria-label={t('management.action.snooze')}
        >
          <Clock className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <div className="space-y-1">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{t('snooze.title')}</p>
          {SNOOZE_PRESETS.map((preset) => (
            <Button
              key={preset.duration}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => handlePresetSnooze(preset.duration)}
              disabled={snoozeMutation.isPending}
            >
              {t(preset.labelKey as never)}
            </Button>
          ))}
          <div className="my-1 border-t border-border" />
          {showCustom ? (
            <div className="space-y-2 px-1">
              <Input
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                className="h-7 text-xs"
                min={new Date().toISOString().slice(0, 16)}
              />
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={handleCustomSnooze}
                disabled={!customDateTime || snoozeMutation.isPending}
              >
                {t('management.action.snooze')}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => setShowCustom(true)}
            >
              {t('snooze.custom')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
