'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AliasInputProps {
  value: string[];
  onChange: (aliases: string[]) => void;
  maxItems?: number;
  disabled?: boolean;
}

export function AliasInput({ value, onChange, maxItems = 50, disabled = false }: AliasInputProps) {
  const t = useTranslations('brands');
  const inputRef = useRef<HTMLInputElement>(null);
  const isMaxReached = value.length >= maxItems;
  const helperId = 'alias-input-helper';

  function addAlias(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const isDuplicate = value.some((a) => a.toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) return;
    if (value.length >= maxItems) return;
    onChange([...value, trimmed]);
  }

  function removeAlias(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      addAlias(input.value);
      input.value = '';
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((alias, index) => (
            <li key={alias}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {alias}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-3.5 rounded-full"
                  onClick={() => removeAlias(index)}
                  disabled={disabled}
                  aria-label={t('aliasInput.removeAlias', { name: alias })}
                >
                  <X className="size-2.5" />
                </Button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        disabled={disabled || isMaxReached}
        placeholder={t('aliasInput.placeholder')}
        aria-label={t('fields.aliases')}
        aria-describedby={helperId}
        className="h-8 text-sm"
        data-testid="alias-input"
      />
      <p id={helperId} className="type-caption text-muted-foreground">
        {isMaxReached ? t('aliasInput.maxReached') : t('aliasInput.placeholder')}
      </p>
    </div>
  );
}
