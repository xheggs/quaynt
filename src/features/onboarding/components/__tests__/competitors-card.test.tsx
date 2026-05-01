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
  it('renders a collapsed summary with the count and a chip for every selected name', () => {
    renderWithOnboardingProviders(<CompetitorsCard {...baseProps} />);
    expect(screen.getByText(/4 competitors found/i)).toBeTruthy();
    // All 4 selected names render as their own chip — no "+N more" overflow at this size.
    expect(screen.getByText('Adyen')).toBeTruthy();
    expect(screen.getByText('Square')).toBeTruthy();
    expect(screen.getByText('Checkout.com')).toBeTruthy();
    expect(screen.getByText('Braintree')).toBeTruthy();
    expect(screen.queryByText(/\+\d+ more/i)).toBeNull();
    // Editor not in DOM until expanded.
    expect(screen.queryByLabelText('Competitor name')).toBeNull();
  });

  it('renders a "+N more" chip when selected names exceed the chip cap', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      name: `Brand ${i + 1}`,
      domain: `brand${i + 1}.com`,
      reason: null,
    }));
    renderWithOnboardingProviders(
      <CompetitorsCard
        {...baseProps}
        competitors={many}
        selected={new Set(many.map((_, i) => i))}
        defaultSelectedCount={many.length}
      />
    );
    expect(screen.getByText(/10 competitors found/i)).toBeTruthy();
    expect(screen.getByText('Brand 1')).toBeTruthy();
    expect(screen.getByText('Brand 8')).toBeTruthy();
    // Cap is 8 — names 9 and 10 are rolled into the overflow chip.
    expect(screen.queryByText('Brand 9')).toBeNull();
    expect(screen.queryByText('Brand 10')).toBeNull();
    expect(screen.getByText(/\+2 more/i)).toBeTruthy();
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
