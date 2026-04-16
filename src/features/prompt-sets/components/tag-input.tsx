'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxItems?: number;
  disabled?: boolean;
}

export function TagInput({ value, onChange, maxItems = 20, disabled = false }: TagInputProps) {
  const t = useTranslations('promptSets');
  const inputRef = useRef<HTMLInputElement>(null);
  const isMaxReached = value.length >= maxItems;
  const helperId = 'tag-input-helper';

  function addTag(raw: string) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    if (value.length >= maxItems) return;
    onChange([...value, trimmed]);
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      addTag(input.value);
      input.value = '';
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag, index) => (
            <li key={tag}>
              <Badge variant="outline" className="gap-1 pr-1">
                {tag}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-3.5 rounded-full"
                  onClick={() => removeTag(index)}
                  disabled={disabled}
                  aria-label={t('tagInput.removeTag', { name: tag })}
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
        placeholder={t('tagInput.placeholder')}
        aria-label={t('fields.tags')}
        aria-describedby={helperId}
        className="h-8 text-sm"
        data-testid="tag-input"
      />
      <p id={helperId} className="type-caption text-muted-foreground">
        {isMaxReached ? t('tagInput.maxReached') : t('tagInput.placeholder')}
      </p>
    </div>
  );
}
