import { describe, it, expect, vi, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';
import { renderWithOpportunityProviders } from './test-utils';
import { OpportunitySummary } from '../opportunity-summary';
import type { OpportunitySummary as OpportunitySummaryType } from '../../opportunity.types';

afterEach(() => {
  cleanup();
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/opportunities',
}));

const mockSummary: OpportunitySummaryType = {
  totalOpportunities: 42,
  missingCount: 28,
  weakCount: 14,
  averageScore: '45.30',
};

describe('OpportunitySummary', () => {
  it('renders 4 KPI cards', () => {
    renderWithOpportunityProviders(<OpportunitySummary summary={mockSummary} />);

    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('28')).toBeDefined();
    expect(screen.getByText('14')).toBeDefined();
    expect(screen.getByText('45.30')).toBeDefined();
  });

  it('shows correct labels', () => {
    renderWithOpportunityProviders(<OpportunitySummary summary={mockSummary} />);

    expect(screen.getByText('Total Opportunities')).toBeDefined();
    expect(screen.getByText('Missing')).toBeDefined();
    expect(screen.getByText('Weak')).toBeDefined();
    expect(screen.getByText('Avg. Score')).toBeDefined();
  });

  it('shows subtexts for missing and weak', () => {
    renderWithOpportunityProviders(<OpportunitySummary summary={mockSummary} />);

    expect(screen.getByText('Brand absent')).toBeDefined();
    expect(screen.getByText('Below median')).toBeDefined();
  });

  it('shows medium score level badge for score 45', () => {
    renderWithOpportunityProviders(<OpportunitySummary summary={mockSummary} />);

    expect(screen.getByText('Medium')).toBeDefined();
  });

  it('shows high score level badge for score >= 60', () => {
    const highSummary = { ...mockSummary, averageScore: '65.00' };
    renderWithOpportunityProviders(<OpportunitySummary summary={highSummary} />);

    expect(screen.getByText('High')).toBeDefined();
  });

  it('shows low score level badge for score < 30', () => {
    const lowSummary = { ...mockSummary, averageScore: '15.00' };
    renderWithOpportunityProviders(<OpportunitySummary summary={lowSummary} />);

    expect(screen.getByText('Low')).toBeDefined();
  });

  it('shows /80 suffix for score', () => {
    renderWithOpportunityProviders(<OpportunitySummary summary={mockSummary} />);

    expect(screen.getByText('/80')).toBeDefined();
  });

  it('has aria-labels on cards', () => {
    const { container } = renderWithOpportunityProviders(
      <OpportunitySummary summary={mockSummary} />
    );

    const cards = container.querySelectorAll('[aria-label]');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithOpportunityProviders(
      <OpportunitySummary summary={mockSummary} />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
