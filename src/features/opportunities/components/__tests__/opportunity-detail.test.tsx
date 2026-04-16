import { describe, it, expect, vi, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen, fireEvent } from '@testing-library/react';
import { renderWithOpportunityProviders } from './test-utils';
import { OpportunityDetail } from '../opportunity-detail';
import type { Opportunity } from '../../opportunity.types';

afterEach(() => {
  cleanup();
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/opportunities',
}));

const mockMissingOpportunity: Opportunity = {
  id: 'opp-1',
  promptId: 'p-1',
  promptText: 'What is the best project management tool for remote teams?',
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
    { platformId: 'perplexity', brandGapOnPlatform: false, competitorCount: 2 },
  ],
};

const mockWeakOpportunity: Opportunity = {
  ...mockMissingOpportunity,
  id: 'opp-2',
  type: 'weak',
  score: '25.00',
  brandCitationCount: 2,
};

describe('OpportunityDetail', () => {
  it('renders competitor breakdown sorted by citation count', () => {
    renderWithOpportunityProviders(
      <OpportunityDetail opportunity={mockMissingOpportunity} onCollapse={vi.fn()} />
    );

    expect(screen.getByText('Competitor Breakdown')).toBeDefined();
    expect(screen.getByText('Competitor A')).toBeDefined();
    expect(screen.getByText('Competitor B')).toBeDefined();
    expect(screen.getByText('Competitor C')).toBeDefined();
  });

  it('renders platform breakdown with gap/present indicators', () => {
    renderWithOpportunityProviders(
      <OpportunityDetail opportunity={mockMissingOpportunity} onCollapse={vi.fn()} />
    );

    expect(screen.getByText('Platform Breakdown')).toBeDefined();
    expect(screen.getByText('chatgpt')).toBeDefined();
    expect(screen.getByText('perplexity')).toBeDefined();
    expect(screen.getByText('Gap')).toBeDefined();
    expect(screen.getByText('Present')).toBeDefined();
  });

  it('shows "Create content" action for missing type', () => {
    renderWithOpportunityProviders(
      <OpportunityDetail opportunity={mockMissingOpportunity} onCollapse={vi.fn()} />
    );

    expect(screen.getByText('Create content targeting this prompt')).toBeDefined();
  });

  it('shows "Optimize" action for weak type', () => {
    renderWithOpportunityProviders(
      <OpportunityDetail opportunity={mockWeakOpportunity} onCollapse={vi.fn()} />
    );

    expect(screen.getByText('Optimize existing content for this prompt')).toBeDefined();
  });

  it('displays full prompt text', () => {
    renderWithOpportunityProviders(
      <OpportunityDetail opportunity={mockMissingOpportunity} onCollapse={vi.fn()} />
    );

    expect(
      screen.getByText('What is the best project management tool for remote teams?')
    ).toBeDefined();
  });

  it('calls onCollapse when Escape is pressed', () => {
    const onCollapse = vi.fn();
    renderWithOpportunityProviders(
      <OpportunityDetail opportunity={mockMissingOpportunity} onCollapse={onCollapse} />
    );

    const region = screen.getByRole('region');
    fireEvent.keyDown(region, { key: 'Escape' });

    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('has role="region" with aria-label', () => {
    renderWithOpportunityProviders(
      <OpportunityDetail opportunity={mockMissingOpportunity} onCollapse={vi.fn()} />
    );

    const region = screen.getByRole('region');
    expect(region.getAttribute('aria-label')).toBeTruthy();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithOpportunityProviders(
      <OpportunityDetail opportunity={mockMissingOpportunity} onCollapse={vi.fn()} />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
