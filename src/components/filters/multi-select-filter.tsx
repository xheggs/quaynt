'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface MultiSelectFilterOption {
  label: string;
  value: string;
}

interface MultiSelectFilterProps {
  options: MultiSelectFilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  placeholder?: string;
  maxSelections?: number;
  searchable?: boolean;
}

export function MultiSelectFilter({
  options,
  value,
  onChange,
  label,
  placeholder,
  maxSelections,
  searchable = true,
}: MultiSelectFilterProps) {
  const t = useTranslations('ui');
  const [open, setOpen] = useState(false);

  const isAtMax = maxSelections !== undefined && value.length >= maxSelections;

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else if (!isAtMax) {
      onChange([...value, optionValue]);
    }
  };

  const handleRemove = (optionValue: string) => {
    onChange(value.filter((v) => v !== optionValue));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean);

  const triggerLabel =
    value.length === 0
      ? (placeholder ?? label)
      : t('filters.selectedCount', { count: value.length });

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            className="h-7 w-48 justify-between"
          >
            <span className="truncate text-xs">{triggerLabel}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0" align="start">
          <Command>
            {searchable && (
              <CommandInput placeholder={placeholder ?? label} className="h-8 text-xs" />
            )}
            <CommandList>
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                {t('filters.noOptions')}
              </CommandEmpty>
              <CommandGroup>
                {value.length > 0 && (
                  <CommandItem
                    onSelect={handleClearAll}
                    className="justify-center text-xs text-muted-foreground"
                  >
                    {t('filters.clearAll')}
                  </CommandItem>
                )}
                {options.map((option) => {
                  const isSelected = value.includes(option.value);
                  const isDisabled = !isSelected && isAtMax;
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label]}
                      disabled={isDisabled}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <div
                        className={cn(
                          'mr-2 flex size-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Check className="size-3" />
                      </div>
                      <span className={cn(isDisabled && 'opacity-50')}>{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => {
            const optionLabel = options.find((o) => o.value === v)?.label ?? v;
            return (
              <Badge key={v} variant="secondary" className="gap-0.5 pr-0.5 text-[0.625rem]">
                <span className="max-w-[8rem] truncate">{optionLabel}</span>
                <button
                  type="button"
                  aria-label={`${t('filters.remove')} ${optionLabel}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                  onClick={() => handleRemove(v)}
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
