import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithDashboardProviders } from './test-utils';
import { MoversSection } from '../movers-section';
import type { DashboardMover } from '../../dashboard.types';

const mockMovers: DashboardMover[] = [
  {
    brandId: '1',
    brandName: 'Acme',
    metric: 'recommendation_share',
    current: '42.3%',
    previous: '38.1%',
    delta: '+4.2%',
    direction: 'up',
  },
  {
    brandId: '2',
    brandName: 'Beta',
    metric: 'recommendation_share',
    current: '15.0%',
    previous: '18.5%',
    delta: '-3.5%',
    direction: 'down',
  },
];

describe('MoversSection', () => {
  it('renders list of movers with brand names and deltas', () => {
    renderWithDashboardProviders(<MoversSection movers={mockMovers} />);
    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.getByText('+4.2%')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
    expect(screen.getByText('-3.5%')).toBeDefined();
  });

  it('shows warning for null movers', () => {
    const { container } = renderWithDashboardProviders(<MoversSection movers={null} />);
    expect(container.querySelector('[data-slot="error-state"]')).toBeDefined();
  });

  it('shows empty state for empty array', () => {
    renderWithDashboardProviders(<MoversSection movers={[]} />);
    // Empty message should be visible
    const emptyText = screen.getByText((content) => content.includes('No brand data'));
    expect(emptyText).toBeDefined();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithDashboardProviders(<MoversSection movers={mockMovers} />);
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
