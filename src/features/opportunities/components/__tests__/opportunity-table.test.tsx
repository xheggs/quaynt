import { describe, it, expect, vi, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen, fireEvent } from '@testing-library/react';
import { renderWithOpportunityProviders } from './test-utils';
import { OpportunityTable } from '../opportunity-table';
import type { Opportunity } from '../../opportunity.types';

afterEach(() => {
  cleanup();
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/opportunities',
}));

const mockOpportunities: Opportunity[] = [
  {
    id: 'opp-1',
    promptId: 'p-1',
    promptText: 'What is the best project management tool?',
    periodStart: '2026-04-01',
    type: 'missing',
    score: '65.00',
    competitorCount: 3,
    totalTrackedBrands: 5,
    platformCount: 2,
    brandCitationCount: 0,
    competitors: [
      { brandId: 'c-1', brandName: 'Competitor A', citationCount: 15 },
      { brandId: 'c-2', brandName: 'Competitor B', citationCount: 8 },
      { brandId: 'c-3', brandName: 'Competitor C', citationCount: 4 },
    ],
    platformBreakdown: [
      { platformId: 'chatgpt', brandGapOnPlatform: true, competitorCount: 3 },
      { platformId: 'perplexity', brandGapOnPlatform: true, competitorCount: 2 },
    ],
  },
  {
    id: 'opp-2',
    promptId: 'p-2',
    promptText: 'Compare Notion vs Asana',
    periodStart: '2026-04-01',
    type: 'weak',
    score: '25.00',
    competitorCount: 2,
    totalTrackedBrands: 5,
    platformCount: 1,
    brandCitationCount: 2,
    competitors: [
      { brandId: 'c-1', brandName: 'Competitor A', citationCount: 10 },
      { brandId: 'c-2', brandName: 'Competitor B', citationCount: 6 },
    ],
    platformBreakdown: [{ platformId: 'gemini', brandGapOnPlatform: false, competitorCount: 2 }],
  },
];

describe('OpportunityTable', () => {
  const defaultProps = {
    opportunities: mockOpportunities,
    sort: 'score' as const,
    order: 'desc' as const,
    onSortChange: vi.fn(),
  };

  it('renders table with all columns', () => {
    renderWithOpportunityProviders(<OpportunityTable {...defaultProps} />);

    expect(screen.getByTestId('opportunity-table')).toBeDefined();
    expect(screen.getByText('Prompt')).toBeDefined();
    expect(screen.getByText('Type')).toBeDefined();
    expect(screen.getByText('Competitors')).toBeDefined();
    expect(screen.getByText('Platforms')).toBeDefined();
  });

  it('renders opportunity data', () => {
    renderWithOpportunityProviders(<OpportunityTable {...defaultProps} />);

    expect(screen.getByText('What is the best project management tool?')).toBeDefined();
    expect(screen.getByText('Compare Notion vs Asana')).toBeDefined();
    expect(screen.getByText('Missing')).toBeDefined();
    expect(screen.getByText('Weak')).toBeDefined();
  });

  it('renders score with bar and value', () => {
    renderWithOpportunityProviders(<OpportunityTable {...defaultProps} />);

    expect(screen.getByText('65.00/80')).toBeDefined();
    expect(screen.getByText('25.00/80')).toBeDefined();
  });

  it('renders competitor chips', () => {
    renderWithOpportunityProviders(<OpportunityTable {...defaultProps} />);

    expect(screen.getAllByText('Competitor A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Competitor B').length).toBeGreaterThan(0);
  });

  it('handles sort click on score column', () => {
    const onSortChange = vi.fn();
    renderWithOpportunityProviders(
      <OpportunityTable {...defaultProps} onSortChange={onSortChange} />
    );

    // Find the Score th and click it
    const scoreHeaders = screen.getAllByRole('columnheader');
    const scoreHeader = scoreHeaders.find((h) => h.textContent?.includes('Score'));
    if (scoreHeader) fireEvent.click(scoreHeader);

    expect(onSortChange).toHaveBeenCalledWith('score', 'asc');
  });

  it('sets aria-sort on active sort column', () => {
    renderWithOpportunityProviders(<OpportunityTable {...defaultProps} />);

    const headers = screen.getAllByRole('columnheader');
    const scoreHeader = headers.find((h) => h.textContent?.includes('Score'));
    expect(scoreHeader?.getAttribute('aria-sort')).toBe('descending');
  });

  it('expands row detail on toggle click', () => {
    renderWithOpportunityProviders(<OpportunityTable {...defaultProps} />);

    const expandButtons = screen.getAllByRole('button', { expanded: false });
    fireEvent.click(expandButtons[0]);

    // After expanding, the detail region should appear
    expect(screen.getByRole('region')).toBeDefined();
    expect(screen.getByText('Competitor Breakdown')).toBeDefined();
  });

  it('collapses row detail on second toggle click', () => {
    renderWithOpportunityProviders(<OpportunityTable {...defaultProps} />);

    const expandButtons = screen.getAllByRole('button', { expanded: false });
    fireEvent.click(expandButtons[0]);

    // Now click the collapse button
    const collapseButton = screen.getByRole('button', { expanded: true });
    fireEvent.click(collapseButton);

    expect(screen.queryByRole('region')).toBeNull();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithOpportunityProviders(<OpportunityTable {...defaultProps} />);
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
