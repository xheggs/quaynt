import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';

import { useApiMutation } from './use-api-mutation';
import { ApiError } from '@/lib/query/types';
import uiMessages from '../../locales/en/ui.json';
import errorsMessages from '../../locales/en/errors.json';

const messages = { ...uiMessages, ...errorsMessages };

// axe accessibility testing exemption: this file tests a hook via renderHook
// which produces no meaningful DOM output — axe assertions are not applicable.

// Mock toast functions
vi.mock('@/lib/toast', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={messages}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return TestWrapper;
}

describe('useApiMutation', () => {
  it('calls onSuccess and shows toast on success', async () => {
    const onSuccess = vi.fn();
    const { showSuccess } = await import('@/lib/toast');

    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: async () => ({ id: '1' }),
          onSuccess,
          successMessage: 'Saved!',
        }),
      { wrapper: createWrapper() }
    );

    result.current.mutate(undefined);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ id: '1' });
      expect(showSuccess).toHaveBeenCalledWith('Saved!');
    });
  });

  it('shows error toast on ApiError', async () => {
    const { showError } = await import('@/lib/toast');

    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: async () => {
            throw new ApiError('BAD_REQUEST', 'BAD_REQUEST', 400);
          },
        }),
      { wrapper: createWrapper() }
    );

    result.current.mutate(undefined);

    await waitFor(() => {
      expect(showError).toHaveBeenCalled();
    });
  });

  it('returns isPending state', async () => {
    let resolve: (value: unknown) => void;
    const promise = new Promise((r) => {
      resolve = r;
    });

    const { result } = renderHook(
      () =>
        useApiMutation({
          mutationFn: () => promise,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isPending).toBe(false);

    result.current.mutate(undefined);

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    resolve!({ ok: true });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});
