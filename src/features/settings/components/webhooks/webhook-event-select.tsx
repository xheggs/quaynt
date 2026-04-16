'use client';

import { useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { WEBHOOK_EVENT_CATEGORIES } from '../../integrations.types';
import { WEBHOOK_EVENT_TYPES } from '@/modules/webhooks/webhook.events';

interface WebhookEventSelectProps {
  value: string[];
  onChange: (events: string[]) => void;
}

interface EventGroup {
  category: string;
  events: string[];
}

function groupEvents(): EventGroup[] {
  return WEBHOOK_EVENT_CATEGORIES.map((category) => ({
    category,
    events: WEBHOOK_EVENT_TYPES.filter((e) => e.startsWith(`${category}.`)),
  })).filter((g) => g.events.length > 0);
}

export function WebhookEventSelect({ value, onChange }: WebhookEventSelectProps) {
  const t = useTranslations('settings');
  const groups = useMemo(() => groupEvents(), []);

  const isAllSelected = value.includes('*');
  const allEventTypes = WEBHOOK_EVENT_TYPES as readonly string[];

  function handleAllToggle(checked: boolean) {
    onChange(checked ? ['*'] : []);
  }

  function handleEventToggle(event: string, checked: boolean) {
    if (isAllSelected) {
      // Switching from "*" to explicit — deselect one
      const allExcept = allEventTypes.filter((e) => e !== event);
      onChange(allExcept as string[]);
    } else if (checked) {
      const next = [...value, event];
      // If all events now selected, switch to "*"
      if (next.length === allEventTypes.length) {
        onChange(['*']);
      } else {
        onChange(next);
      }
    } else {
      onChange(value.filter((e) => e !== event));
    }
  }

  function isEventChecked(event: string): boolean {
    return isAllSelected || value.includes(event);
  }

  // Display label
  let triggerLabel: string;
  if (isAllSelected) {
    triggerLabel = t('webhooks.form.allEvents');
  } else if (value.length === 0) {
    triggerLabel = t('webhooks.form.eventsLabel');
  } else {
    triggerLabel = t('webhooks.eventsSelected', { count: value.length });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {triggerLabel}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <div className="max-h-[320px] overflow-y-auto p-3">
          {/* All events toggle */}
          <div className="flex items-center gap-2 pb-3">
            <Checkbox id="all-events" checked={isAllSelected} onCheckedChange={handleAllToggle} />
            <Label htmlFor="all-events" className="cursor-pointer font-medium">
              {t('webhooks.form.allEvents')}
            </Label>
            {isAllSelected && <Check className="ml-auto size-4 text-green-600" />}
          </div>

          <div className="border-t pt-2">
            {groups.map((group) => (
              <div key={group.category} className="mb-3">
                <p className="mb-1.5 type-overline text-muted-foreground">
                  {t(`webhooks.eventCategories.${group.category}` as never)}
                </p>
                <div className="space-y-1">
                  {group.events.map((event) => (
                    <div key={event} className="flex items-center gap-2">
                      <Checkbox
                        id={`event-${event}`}
                        checked={isEventChecked(event)}
                        onCheckedChange={(checked) => handleEventToggle(event, !!checked)}
                      />
                      <Label
                        htmlFor={`event-${event}`}
                        className="cursor-pointer font-mono text-xs font-normal"
                      >
                        {event}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
