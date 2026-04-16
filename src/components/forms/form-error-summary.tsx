'use client';

import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FormErrorSummaryProps {
  errors: { message: string }[];
}

export function FormErrorSummary({ errors }: FormErrorSummaryProps) {
  const t = useTranslations('ui');

  if (errors.length === 0) return null;

  return (
    <div
      data-slot="form-error-summary"
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-xs font-medium">{t('form.validationError')}</p>
        <ul className="list-inside list-disc text-xs">
          {errors.map((error, i) => (
            <li key={i}>{error.message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
