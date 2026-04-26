import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import uiMessages from '../../../../../locales/en/ui.json';
import onboardingMessages from '../../../../../locales/en/onboarding.json';
import citationsMessages from '../../../../../locales/en/citations.json';
import modelRunsMessages from '../../../../../locales/en/modelRuns.json';

const messages = {
  ...uiMessages,
  ...onboardingMessages,
  ...citationsMessages,
  ...modelRunsMessages,
};

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function AllProviders({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: QueryClient;
}) {
  const queryClient = client ?? createTestQueryClient();

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

export function renderWithOnboardingProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { client?: QueryClient }
) {
  const { client, ...rest } = options ?? {};
  return render(ui, {
    wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    ...rest,
  });
}
