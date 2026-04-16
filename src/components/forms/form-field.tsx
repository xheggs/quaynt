import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface FormFieldInputProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
  'aria-required'?: true;
}

interface FormFieldProps {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  children: (props: FormFieldInputProps) => ReactNode;
}

export function FormField({ name, label, error, required, children }: FormFieldProps) {
  const errorId = `${name}-error`;
  const inputProps: FormFieldInputProps = {
    id: name,
    'aria-invalid': !!error,
    ...(error ? { 'aria-describedby': errorId } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children(inputProps)}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
