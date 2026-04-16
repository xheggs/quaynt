import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithDashboardProviders } from './test-utils';
import { OpportunitiesSection } from '../opportunities-section';
import type { DashboardOpportunity } from '../../dashboard.types';

const mockOpportunities: DashboardOpportunity[] = [
  {
    brandId: '1',
    brandName: 'Acme',
    query: 'best project management tools',
    type: 'missing',
    competitorCount: 3,
  },
  {
    brandId: '2',
    brandName: 'Beta',
    query: 'top CRM software for startups',
    type: 'weak',
    competitorCount: 5,
  },
];

describe('OpportunitiesSection', () => {
  it('renders list with query text and brand names', () => {
    renderWithDashboardProviders(<OpportunitiesSection opportunities={mockOpportunities} />);
    expect(screen.getByText('best project management tools')).toBeDefined();
    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.getByText('top CRM software for startups')).toBeDefined();
  });

  it('renders type badges', () => {
    const { container } = renderWithDashboardProviders(
      <OpportunitiesSection opportunities={mockOpportunities} />
    );
    const badges = container.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(2);
  });

  it('renders competitor count', () => {
    const { container } = renderWithDashboardProviders(
      <OpportunitiesSection opportunities={mockOpportunities} />
    );
    const list = container.querySelector('[data-testid="opportunities-list"]');
    expect(list?.textContent).toContain('3 competitors');
    expect(list?.textContent).toContain('5 competitors');
  });

  it('shows warning for null', () => {
    const { container } = renderWithDashboardProviders(
      <OpportunitiesSection opportunities={null} />
    );
    expect(container.querySelector('[data-slot="error-state"]')).toBeDefined();
  });

  it('shows empty state for empty array', () => {
    renderWithDashboardProviders(<OpportunitiesSection opportunities={[]} />);
    const emptyText = screen.getByText((content) => content.includes('No opportunities'));
    expect(emptyText).toBeDefined();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithDashboardProviders(
      <OpportunitiesSection opportunities={mockOpportunities} />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
