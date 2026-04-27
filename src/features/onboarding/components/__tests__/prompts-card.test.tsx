import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';

import { renderWithOnboardingProviders } from './test-utils';
import { PromptsCard } from '../review/prompts-card';

const basePrompts = [
  { text: 'Best payment processor for SaaS?', tag: null },
  { text: 'Stripe vs Adyen for online commerce', tag: null },
  { text: 'Cheapest checkout for European startups', tag: null },
  { text: 'Which payment platform supports recurring billing?', tag: null },
  { text: 'Top 5 payment APIs for developers', tag: null },
];

const baseProps = {
  noEngine: false,
  partialError: null as string | null,
  prompts: basePrompts,
  onPromptsChange: vi.fn(),
  choice: 'suggested' as const,
  onChoiceChange: vi.fn(),
  starterAvailable: true,
  starterPromptCount: 8,
  locale: 'en',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PromptsCard', () => {
  it('renders a collapsed summary with the prompt count and the first prompt', () => {
    renderWithOnboardingProviders(<PromptsCard {...baseProps} />);
    expect(screen.getByText(/5 prompts drafted/i)).toBeTruthy();
    expect(screen.getByText(/Best payment processor for SaaS\?/i)).toBeTruthy();
    // Full list NOT visible until expanded.
    expect(screen.queryByText(/Top 5 payment APIs for developers/i)).toBeNull();
  });

  it('renders the choice toggle inside the collapsed summary', () => {
    renderWithOnboardingProviders(<PromptsCard {...baseProps} />);
    expect(screen.getByLabelText(/Use these 5 suggested prompts/i)).toBeTruthy();
    expect(screen.getByLabelText(/Use the Quaynt starter set/i)).toBeTruthy();
    expect(screen.getByLabelText(/Skip and add prompts later/i)).toBeTruthy();
  });

  it('switches the headline copy when "starter" is the active choice', () => {
    renderWithOnboardingProviders(<PromptsCard {...baseProps} choice="starter" />);
    expect(screen.getByText(/Quaynt starter set selected/i)).toBeTruthy();
    expect(screen.queryByText(/5 prompts drafted/i)).toBeNull();
  });

  it('switches the headline copy when "skip" is the active choice', () => {
    renderWithOnboardingProviders(<PromptsCard {...baseProps} choice="skip" />);
    expect(screen.getByText(/Skipping — you'll add prompts later/i)).toBeTruthy();
  });

  it('expands to show the full list as editable inputs and a Collapse button', () => {
    renderWithOnboardingProviders(<PromptsCard {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit prompts/i }));
    expect(screen.getByDisplayValue(/Top 5 payment APIs for developers/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Collapse/i })).toBeTruthy();
  });

  it('opens expanded when initiallyExpanded is true and hides the Collapse button', () => {
    renderWithOnboardingProviders(<PromptsCard {...baseProps} initiallyExpanded />);
    expect(screen.getByDisplayValue(/Top 5 payment APIs for developers/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit prompts/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Collapse/i })).toBeNull();
  });

  it('removes a prompt when its remove button is clicked', () => {
    const onPromptsChange = vi.fn();
    renderWithOnboardingProviders(
      <PromptsCard {...baseProps} onPromptsChange={onPromptsChange} initiallyExpanded />
    );
    const removeButtons = screen.getAllByRole('button', { name: /Remove prompt/i });
    fireEvent.click(removeButtons[0]);
    expect(onPromptsChange).toHaveBeenCalledWith(basePrompts.slice(1));
  });

  it('adds a new prompt when typing into the draft input and clicking Add', () => {
    const onPromptsChange = vi.fn();
    renderWithOnboardingProviders(
      <PromptsCard {...baseProps} onPromptsChange={onPromptsChange} initiallyExpanded />
    );
    const draftInput = screen.getByPlaceholderText(/Type a prompt and press Enter/i);
    fireEvent.change(draftInput, { target: { value: 'A brand new prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add prompt$/i }));
    expect(onPromptsChange).toHaveBeenCalledWith([
      ...basePrompts,
      { text: 'A brand new prompt', tag: null },
    ]);
  });

  it('renders the partial-error notice instead of the summary or editor', () => {
    renderWithOnboardingProviders(
      <PromptsCard {...baseProps} partialError="Prompts engine refused" />
    );
    expect(screen.getByText(/Prompts engine refused/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit prompts/i })).toBeNull();
  });

  it('uses singular plural form when exactly one prompt is drafted', () => {
    renderWithOnboardingProviders(
      <PromptsCard {...baseProps} prompts={[{ text: 'One prompt', tag: null }]} />
    );
    expect(screen.getByText(/^1 prompt drafted$/i)).toBeTruthy();
  });
});
