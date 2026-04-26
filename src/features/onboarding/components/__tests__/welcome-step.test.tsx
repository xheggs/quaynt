import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithOnboardingProviders } from './test-utils';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/en/onboarding/welcome',
}));

const createSuggestionMock = vi.fn();
vi.mock('@/features/onboarding/hooks/use-suggestion', () => ({
  useCreateSuggestion: () => ({
    mutateAsync: createSuggestionMock,
    isPending: false,
  }),
}));

// Surface a way to assert the welcome step does NOT call useUpdateOnboarding.
// If the spy is invoked, the regression-guard test fails.
const updateMutateSpy = vi.fn();
vi.mock('@/features/onboarding/hooks/use-onboarding', () => ({
  useOnboarding: () => ({ data: undefined }),
  useUpdateOnboarding: () => ({
    mutate: updateMutateSpy,
    mutateAsync: updateMutateSpy,
    isPending: false,
  }),
}));

import { WelcomeStep } from '../welcome-step';

afterEach(() => {
  cleanup();
  pushMock.mockReset();
  createSuggestionMock.mockReset();
  updateMutateSpy.mockReset();
});

describe('WelcomeStep (editorial domain hero)', () => {
  it('does not render any persona role tiles', () => {
    renderWithOnboardingProviders(<WelcomeStep />);
    expect(screen.queryByText('Marketing')).toBeNull();
    expect(screen.queryByText('SEO / GEO')).toBeNull();
    expect(screen.queryByText('Founder')).toBeNull();
    expect(screen.queryByText('Agency')).toBeNull();
  });

  it('autofocuses the domain input on mount', () => {
    renderWithOnboardingProviders(<WelcomeStep />);
    const input = screen.getByPlaceholderText('example.com');
    expect(document.activeElement).toBe(input);
  });

  it('does not render an aria-live region at first paint', () => {
    const { container } = renderWithOnboardingProviders(<WelcomeStep />);
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('renders a single primary CTA and a ghost skip-manual link', () => {
    renderWithOnboardingProviders(<WelcomeStep />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: /skip and enter everything manually/i })
    ).toBeDefined();
  });

  it('navigates to /onboarding/brand on skip click without calling update', () => {
    renderWithOnboardingProviders(<WelcomeStep />);
    fireEvent.click(screen.getByRole('button', { name: /skip and enter everything manually/i }));
    expect(pushMock).toHaveBeenCalledWith('/en/onboarding/brand');
    expect(updateMutateSpy).not.toHaveBeenCalled();
  });

  it('on submit, calls only createSuggestion (regression guard: never persists roleHint)', async () => {
    createSuggestionMock.mockResolvedValueOnce({ id: 'job_123' });
    renderWithOnboardingProviders(<WelcomeStep />);

    const input = screen.getByPlaceholderText('example.com');
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(createSuggestionMock).toHaveBeenCalledWith('example.com'));
    expect(pushMock).toHaveBeenCalledWith('/en/onboarding/review/job_123');
    expect(updateMutateSpy).not.toHaveBeenCalled();
  });

  it('shows an inline error and skips the request when domain is empty', async () => {
    renderWithOnboardingProviders(<WelcomeStep />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByText(/Enter a valid domain/i)).toBeDefined());
    expect(createSuggestionMock).not.toHaveBeenCalled();
  });
});
