'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SelectFilterOption {
  label: string;
  value: string;
}

interface SelectFilterProps {
  options: SelectFilterOption[];
  value?: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}

export function SelectFilter({ options, value, onChange, label, placeholder }: SelectFilterProps) {
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-40" aria-label={label}>
        <SelectValue placeholder={placeholder ?? label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
