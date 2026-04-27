import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';

import { renderWithOnboardingProviders } from './test-utils';
import { CompetitorsCard } from '../review/competitors-card';

const baseProps = {
  noEngine: false,
  partialError: null as string | null,
  competitors: [
    { name: 'Adyen', domain: 'adyen.com', reason: null },
    { name: 'Square', domain: 'square.com', reason: null },
    { name: 'Checkout.com', domain: 'checkout.com', reason: null },
    { name: 'Braintree', domain: 'braintree.com', reason: null },
  ],
  selected: new Set([0, 1, 2, 3]),
  extras: [],
  onToggle: vi.fn(),
  onAddExtra: vi.fn(),
  onUpdateExtra: vi.fn(),
  onRemoveExtra: vi.fn(),
  locale: 'en',
  brandName: 'Stripe',
  defaultSelectedCount: 4,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CompetitorsCard', () => {
  it('renders a collapsed summary with first names and a "+N more" indicator', () => {
    renderWithOnboardingProviders(<CompetitorsCard {...baseProps} />);
    expect(screen.getByText(/4 competitors found/i)).toBeTruthy();
    // First 3 names included, 4th rolled into "+1 more".
    expect(screen.getByText(/Adyen, Square, Checkout\.com/i)).toBeTruthy();
    expect(screen.getByText(/\+1 more/i)).toBeTruthy();
    // Editor not in DOM until expanded.
    expect(screen.queryByLabelText('Competitor name')).toBeNull();
  });

  it('expands to show the editor when "Edit competitors" is clicked', () => {
    renderWithOnboardingProviders(<CompetitorsCard {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit competitors/i }));
    expect(screen.getAllByRole('checkbox').length).toBe(4);
    expect(screen.getByRole('button', { name: /Add another/i })).toBeTruthy();
  });

  it('opens expanded when initiallyExpanded is true (no-engine path)', () => {
    renderWithOnboardingProviders(
      <CompetitorsCard
        {...baseProps}
        noEngine
        competitors={[]}
        selected={new Set()}
        extras={[{ name: '', domain: '' }]}
        defaultSelectedCount={0}
        initiallyExpanded
      />
    );
    // Manual entry inputs are visible immediately.
    expect(screen.getByPlaceholderText('Competitor')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit competitors/i })).toBeNull();
  });

  it('shows an "edited" indicator when selection diverges from the default', () => {
    const { rerender } = renderWithOnboardingProviders(
      <CompetitorsCard {...baseProps} selected={new Set([0, 1])} defaultSelectedCount={4} />
    );
    const suffix = screen.getByTestId('competitors-edited-suffix');
    expect(suffix.textContent).toMatch(/2 edits/i);

    // No suffix when nothing has diverged.
    rerender(
      <CompetitorsCard {...baseProps} selected={new Set([0, 1, 2, 3])} defaultSelectedCount={4} />
    );
    expect(screen.queryByTestId('competitors-edited-suffix')).toBeNull();
  });

  it('counts a non-empty manual extra towards the edited indicator', () => {
    renderWithOnboardingProviders(
      <CompetitorsCard
        {...baseProps}
        selected={new Set([0, 1, 2, 3])}
        defaultSelectedCount={4}
        extras={[{ name: 'New rival', domain: '' }]}
      />
    );
    expect(screen.getByTestId('competitors-edited-suffix').textContent).toMatch(/1 edit/i);
  });

  it('uses singular form when exactly one competitor is selected', () => {
    renderWithOnboardingProviders(
      <CompetitorsCard
        {...baseProps}
        competitors={[{ name: 'Adyen', domain: null, reason: null }]}
        selected={new Set([0])}
        defaultSelectedCount={1}
      />
    );
    expect(screen.getByText(/^1 competitor found/i)).toBeTruthy();
  });

  it('renders the partial-error notice instead of the summary or editor', () => {
    renderWithOnboardingProviders(
      <CompetitorsCard {...baseProps} partialError="Engine refused this stage" />
    );
    expect(screen.getByText(/Engine refused this stage/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit competitors/i })).toBeNull();
  });

  it('keeps editing controls reachable via the expanded editor', () => {
    const onAddExtra = vi.fn();
    const onToggle = vi.fn();
    renderWithOnboardingProviders(
      <CompetitorsCard {...baseProps} onAddExtra={onAddExtra} onToggle={onToggle} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit competitors/i }));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onToggle).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: /Add another/i }));
    expect(onAddExtra).toHaveBeenCalledTimes(1);
    // Collapse button is reachable.
    const collapse = screen.getByRole('button', { name: /Collapse/i });
    expect(collapse).toBeTruthy();
    fireEvent.click(collapse);
    expect(
      within(screen.getByRole('button', { name: /Edit competitors/i })).queryAllByText(/Edit/i)
        .length
    ).toBeGreaterThan(0);
  });
});
