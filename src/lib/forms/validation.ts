import type { UseFormReturn } from 'react-hook-form';
import { ApiError } from '@/lib/query/types';

/**
 * Maps API error details to react-hook-form field errors.
 * Returns any errors that could not be mapped to a registered field.
 */
export function resolveFormErrors(
  error: ApiError,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
): { unmapped: { message: string }[] } {
  const unmapped: { message: string }[] = [];

  if (!error.details?.length) {
    return { unmapped: [{ message: error.message }] };
  }

  for (const detail of error.details) {
    try {
      form.setError(detail.field, { type: 'server', message: detail.message });
    } catch {
      unmapped.push({ message: `${detail.field}: ${detail.message}` });
    }
  }

  return { unmapped };
}
