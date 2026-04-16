import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithBenchmarkProviders } from './test-utils';
import { PlatformBreakdown } from '../platform-breakdown';
import type { BrandBenchmark } from '../../benchmark.types';

const brandsWithBreakdown: BrandBenchmark[] = [
  {
    brandId: '1',
    brandName: 'Acme',
    rank: 1,
    rankChange: 0,
    recommendationShare: { current: '42.5', previous: '38.1', delta: '4.4', direction: 'up' },
    citationCount: { current: 120, previous: 100, delta: 20 },
    modelRunCount: 5,
    platformBreakdown: [
      { platformId: 'ChatGPT', sharePercentage: '55.0', delta: '5.0', citationCount: 66 },
      { platformId: 'Perplexity', sharePercentage: '30.0', delta: '-2.0', citationCount: 36 },
    ],
  },
  {
    brandId: '2',
    brandName: 'Beta',
    rank: 2,
    rankChange: -1,
    recommendationShare: { current: '28.3', previous: '30.0', delta: '-1.7', direction: 'down' },
    citationCount: { current: 80, previous: 85, delta: -5 },
    modelRunCount: 5,
    platformBreakdown: [
      { platformId: 'ChatGPT', sharePercentage: '20.0', delta: '-3.0', citationCount: 24 },
      { platformId: 'Perplexity', sharePercentage: '40.0', delta: '2.0', citationCount: 48 },
    ],
  },
];

const brandsWithoutBreakdown: BrandBenchmark[] = [
  {
    brandId: '1',
    brandName: 'Acme',
    rank: 1,
    rankChange: 0,
    recommendationShare: { current: '42.5', previous: null, delta: null, direction: null },
    citationCount: { current: 120, previous: null, delta: null },
    modelRunCount: 5,
  },
];

describe('PlatformBreakdown', () => {
  it('renders brand x platform grid with breakdown data', () => {
    renderWithBenchmarkProviders(<PlatformBreakdown brands={brandsWithBreakdown} />);
    const table = screen.getByTestId('platform-breakdown');
    expect(table).toBeDefined();
    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
    expect(screen.getByText('ChatGPT')).toBeDefined();
    expect(screen.getByText('Perplexity')).toBeDefined();
  });

  it('shows message when no breakdown available', () => {
    renderWithBenchmarkProviders(<PlatformBreakdown brands={brandsWithoutBreakdown} />);
    expect(screen.getByText("Select 'All platforms' to see the platform breakdown")).toBeDefined();
  });

  it('applies colour intensity based on share value', () => {
    const { container } = renderWithBenchmarkProviders(
      <PlatformBreakdown brands={brandsWithBreakdown} />
    );
    // High-share cells should have bg-primary/30
    const highShareCells = container.querySelectorAll('.bg-primary\\/30');
    expect(highShareCells.length).toBeGreaterThan(0);
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithBenchmarkProviders(
      <PlatformBreakdown brands={brandsWithBreakdown} />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
