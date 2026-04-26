import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

import { renderWithOnboardingProviders } from './test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/onboarding/review/job_1',
}));

const useSuggestionMock = vi.fn();
const createSuggestionMutate = vi.fn();
vi.mock('../../hooks/use-suggestion', () => ({
  useSuggestion: (jobId: string | null) => useSuggestionMock(jobId),
  useCreateSuggestion: () => ({
    mutateAsync: createSuggestionMutate,
    isPending: false,
  }),
}));

vi.mock('@/features/onboarding/hooks/use-onboarding', () => ({
  useOnboarding: () => ({ data: undefined }),
  useUpdateOnboarding: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/features/brands', () => ({
  fetchBrands: vi.fn().mockResolvedValue({ data: [] }),
  createBrand: vi.fn(),
}));

vi.mock('@/features/prompt-sets', () => ({
  fetchPromptSets: vi.fn().mockResolvedValue({ data: [] }),
  fetchPrompts: vi.fn().mockResolvedValue([]),
  createPromptSet: vi.fn(),
  addPrompt: vi.fn(),
}));

vi.mock('@/features/model-runs', () => ({
  createModelRun: vi.fn(),
}));

vi.mock('@/features/settings', () => ({
  fetchAdapters: vi.fn().mockResolvedValue({ data: [] }),
}));

import { ReviewStep } from '../review-step';

afterEach(() => {
  cleanup();
  useSuggestionMock.mockReset();
  createSuggestionMutate.mockReset();
});

describe('ReviewStep (editorial confirm)', () => {
  it('renders a skeleton when the suggestion is still pending', () => {
    useSuggestionMock.mockReturnValue({
      data: { status: 'pending', domain: 'example.com' },
    });
    renderWithOnboardingProviders(<ReviewStep jobId="job_1" />);
    expect(screen.getAllByTestId(/^review-skeleton-/).length).toBeGreaterThan(0);
  });

  it('renders the editorial heading without any step-of-N copy', () => {
    useSuggestionMock.mockReturnValue({
      data: { status: 'pending', domain: 'example.com' },
    });
    renderWithOnboardingProviders(<ReviewStep jobId="job_1" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Here's what we found/i);
    expect(screen.queryByText(/Step \d of/)).toBeNull();
  });

  it('renders the host string inside a font-mono <code> via t.rich', () => {
    useSuggestionMock.mockReturnValue({
      data: { status: 'pending', domain: 'example.com' },
    });
    const { container } = renderWithOnboardingProviders(<ReviewStep jobId="job_1" />);
    const code = container.querySelector('code.font-mono');
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe('example.com');
  });

  it('renders the single primary CTA when the suggestion is done', () => {
    useSuggestionMock.mockReturnValue({
      data: {
        status: 'done',
        domain: 'example.com',
        engineUsed: 'openai',
        extracted: { brandName: 'Acme', aliases: [], description: null, categories: [] },
        suggestedCompetitors: [],
        suggestedPrompts: [{ text: 'How does Acme compare?', tag: null }],
        error: null,
      },
    });
    renderWithOnboardingProviders(<ReviewStep jobId="job_1" />);
    const primary = screen.getAllByRole('button', {
      name: /Start tracking|brand name to continue/i,
    });
    expect(primary.length).toBe(1);
  });

  it('renders the Regenerate button when an engine produced the suggestion', () => {
    useSuggestionMock.mockReturnValue({
      data: {
        status: 'done',
        domain: 'example.com',
        engineUsed: 'openai',
        extracted: { brandName: 'Acme', aliases: [], description: null, categories: [] },
        suggestedCompetitors: [{ name: 'Other', domain: 'other.com', reason: null }],
        suggestedPrompts: [{ text: 'How does Acme compare?', tag: null }],
        error: null,
      },
    });
    renderWithOnboardingProviders(<ReviewStep jobId="job_1" />);
    expect(screen.getByRole('button', { name: /Regenerate/i })).toBeTruthy();
  });

  it('hides Regenerate and renders manual-entry rows when no engine is configured', () => {
    useSuggestionMock.mockReturnValue({
      data: {
        status: 'done',
        domain: 'example.com',
        engineUsed: null,
        extracted: { brandName: 'Acme', aliases: [], description: null, categories: [] },
        suggestedCompetitors: null,
        suggestedPrompts: null,
        error: null,
      },
    });
    renderWithOnboardingProviders(<ReviewStep jobId="job_1" />);
    expect(screen.queryByRole('button', { name: /Regenerate/i })).toBeNull();
    expect(screen.queryByText(/Auto-suggestions aren't available/i)).toBeNull();
    expect(screen.getByPlaceholderText('Competitor')).toBeTruthy();
  });
});
