'use client';

import { useCallback, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

interface TemplateColorInputProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  helpText?: string;
}

export function TemplateColorInput({ label, value, onChange, helpText }: TemplateColorInputProps) {
  const [textValue, setTextValue] = useState(value);
  const inputId = useMemo(() => `color-${label.toLowerCase().replace(/\s+/g, '-')}`, [label]);

  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value;
      setTextValue(hex);
      onChange(hex);
    },
    [onChange]
  );

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextValue(e.target.value);
  }, []);

  const handleTextBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const currentValue = e.target.value;
      if (HEX_REGEX.test(currentValue)) {
        onChange(currentValue);
      } else {
        setTextValue(value);
      }
    },
    [value, onChange]
  );

  // Keep text in sync when the parent value changes (e.g., form reset)
  const displayValue = HEX_REGEX.test(textValue) ? textValue : value;
  if (textValue !== value && textValue === displayValue) {
    // Only sync if the text input has a valid hex that differs from the parent
    // This is intentional — user is editing and hasn't blurred yet
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={handleColorPickerChange}
          aria-label={label}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
        />
        <Input
          id={inputId}
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          placeholder="#000000"
          className="w-28 font-mono text-sm"
        />
        <span
          className="inline-block size-6 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
      </div>
      {helpText && <p className="type-caption text-muted-foreground">{helpText}</p>}
    </div>
  );
}
