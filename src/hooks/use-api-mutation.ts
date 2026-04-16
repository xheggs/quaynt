'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { ApiError } from '@/lib/query/types';
import { showSuccess, showError } from '@/lib/toast';
import { resolveFormErrors } from '@/lib/forms/validation';
import { translateApiError } from '@/lib/query/error-messages';

interface UseApiMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: readonly (readonly unknown[])[];
  onSuccess?: (data: TData) => void;
  successMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form?: UseFormReturn<any>;
}

/**
 * Standard mutation hook with toast integration and API error-to-form mapping.
 *
 * - On success: shows success toast, invalidates specified query keys, calls onSuccess
 * - On error: maps field errors to form (if provided), shows error toast
 */
export function useApiMutation<TData, TVariables>({
  mutationFn,
  invalidateKeys,
  onSuccess,
  successMessage,
  form,
}: UseApiMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const t = useTranslations('ui');
  const tErrors = useTranslations('errors.api');

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      if (successMessage) {
        showSuccess(successMessage);
      }

      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [...key] });
        }
      }

      onSuccess?.(data);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (form && error.details?.length) {
          resolveFormErrors(error, form);
        }
        const description = error.details?.length
          ? t('toast.validationErrorCount', { count: error.details.length })
          : undefined;
        showError(translateApiError(tErrors, error), { description });
      } else {
        showError(tErrors('unknown'));
      }
    },
  });
}
