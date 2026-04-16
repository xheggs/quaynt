import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithBenchmarkProviders } from './test-utils';
import { ShareBarChart } from '../share-bar-chart';
import type { BrandBenchmark } from '../../benchmark.types';

// Mock ECharts since it requires DOM APIs not available in JSDOM
vi.mock('@/components/charts', () => ({
  EChartsWrapper: ({ ariaLabel }: { ariaLabel: string; [k: string]: unknown }) => (
    <div role="img" aria-label={ariaLabel} data-testid="echarts-wrapper" />
  ),
}));

const mockBrands: BrandBenchmark[] = [
  {
    brandId: '1',
    brandName: 'Acme',
    rank: 1,
    rankChange: 0,
    recommendationShare: { current: '42.5', previous: '38.1', delta: '4.4', direction: 'up' },
    citationCount: { current: 120, previous: 100, delta: 20 },
    modelRunCount: 5,
  },
];

describe('ShareBarChart', () => {
  it('renders ECharts container with aria-label', () => {
    const { container } = renderWithBenchmarkProviders(
      <ShareBarChart brands={mockBrands} marketName="Test Market" />
    );
    const chart = container.querySelector('[role="img"]');
    expect(chart).toBeDefined();
    expect(chart?.getAttribute('aria-label')).toContain('Test Market');
  });

  it('returns nothing for empty brands', () => {
    const { container } = renderWithBenchmarkProviders(
      <ShareBarChart brands={[]} marketName="Test Market" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithBenchmarkProviders(
      <ShareBarChart brands={mockBrands} marketName="Test Market" />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
