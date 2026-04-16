import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithBenchmarkProviders } from './test-utils';
import { PeriodComparisonChart } from '../period-comparison-chart';
import type { BrandBenchmark } from '../../benchmark.types';

vi.mock('@/components/charts', () => ({
  EChartsWrapper: ({ ariaLabel }: { ariaLabel: string }) => (
    <div role="img" aria-label={ariaLabel} data-testid="echarts-wrapper" />
  ),
}));

const period = {
  from: '2026-03-12',
  to: '2026-04-10',
  comparisonFrom: '2026-02-10',
  comparisonTo: '2026-03-11',
};

const brandsWithComparison: BrandBenchmark[] = [
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

const brandsWithoutComparison: BrandBenchmark[] = [
  {
    brandId: '1',
    brandName: 'Acme',
    rank: 1,
    rankChange: null,
    recommendationShare: { current: '42.5', previous: null, delta: null, direction: null },
    citationCount: { current: 120, previous: null, delta: null },
    modelRunCount: 5,
  },
];

describe('PeriodComparisonChart', () => {
  it('renders ECharts container with aria-label when comparison data exists', () => {
    const { container } = renderWithBenchmarkProviders(
      <PeriodComparisonChart
        brands={brandsWithComparison}
        period={period}
        marketName="Test Market"
      />
    );
    const chart = container.querySelector('[role="img"]');
    expect(chart).toBeDefined();
    expect(chart?.getAttribute('aria-label')).toContain('Test Market');
  });

  it('shows "not enough data" message when no comparison data', () => {
    renderWithBenchmarkProviders(
      <PeriodComparisonChart
        brands={brandsWithoutComparison}
        period={period}
        marketName="Test Market"
      />
    );
    expect(screen.getByText('Not enough data to display chart')).toBeDefined();
  });

  it('returns nothing for empty brands', () => {
    const { container } = renderWithBenchmarkProviders(
      <PeriodComparisonChart brands={[]} period={period} marketName="Test Market" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithBenchmarkProviders(
      <PeriodComparisonChart
        brands={brandsWithComparison}
        period={period}
        marketName="Test Market"
      />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
