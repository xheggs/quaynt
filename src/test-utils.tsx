import { render, type RenderOptions } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { expect } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

// Load English messages for tests
import messages from '../locales/en/ui.json';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <NuqsTestingAdapter>
      <NextIntlClientProvider locale="en" messages={messages}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    </NuqsTestingAdapter>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Shared axe accessibility assertion for component tests.
 * color-contrast is disabled because jsdom cannot compute styles —
 * contrast is verified separately via the design token test and Playwright page scans.
 */
export async function expectAccessible(container: HTMLElement) {
  expect(
    await axe(container, { rules: { 'color-contrast': { enabled: false } } })
  ).toHaveNoViolations();
}

export { render };
