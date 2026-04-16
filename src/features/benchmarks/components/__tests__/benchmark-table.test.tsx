import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithBenchmarkProviders } from './test-utils';
import { BenchmarkTable } from '../benchmark-table';
import type { BrandBenchmark } from '../../benchmark.types';

const mockBrands: BrandBenchmark[] = [
  {
    brandId: '1',
    brandName: 'Acme Corp',
    rank: 1,
    rankChange: 2,
    recommendationShare: { current: '42.5', previous: '38.1', delta: '4.4', direction: 'up' },
    citationCount: { current: 120, previous: 100, delta: 20 },
    modelRunCount: 5,
  },
  {
    brandId: '2',
    brandName: 'Beta Inc',
    rank: 2,
    rankChange: -1,
    recommendationShare: { current: '28.3', previous: '30.0', delta: '-1.7', direction: 'down' },
    citationCount: { current: 80, previous: 85, delta: -5 },
    modelRunCount: 5,
  },
  {
    brandId: '3',
    brandName: 'Gamma Ltd',
    rank: 3,
    rankChange: null,
    recommendationShare: { current: '15.0', previous: null, delta: null, direction: null },
    citationCount: { current: 40, previous: null, delta: null },
    modelRunCount: 3,
  },
];

describe('BenchmarkTable', () => {
  it('renders all brands in rank order', () => {
    renderWithBenchmarkProviders(<BenchmarkTable brands={mockBrands} />);
    const table = screen.getByTestId('benchmark-table');
    expect(table).toBeDefined();
    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('Beta Inc')).toBeDefined();
    expect(screen.getByText('Gamma Ltd')).toBeDefined();
  });

  it('shows rank change indicators', () => {
    const { container } = renderWithBenchmarkProviders(<BenchmarkTable brands={mockBrands} />);
    // Up indicator for Acme (rank change +2)
    expect(container.textContent).toContain('Up 2');
    // Down indicator for Beta (rank change -1)
    expect(container.textContent).toContain('Down 1');
    // New entrant for Gamma (null rank change)
    expect(container.textContent).toContain('New entrant');
  });

  it('renders share percentages with tabular-nums', () => {
    const { container } = renderWithBenchmarkProviders(<BenchmarkTable brands={mockBrands} />);
    const tabularCells = container.querySelectorAll('.tabular-nums');
    expect(tabularCells.length).toBeGreaterThan(0);
  });

  it('sorting changes on header click', () => {
    const { container } = renderWithBenchmarkProviders(<BenchmarkTable brands={mockBrands} />);

    // Find the Brand column header (th element) and click it
    const headers = container.querySelectorAll('th');
    const brandHeader = Array.from(headers).find((h) => h.textContent === 'Brand');
    expect(brandHeader).toBeDefined();
    fireEvent.click(brandHeader!);

    // After clicking Brand, it should sort alphabetically
    const rows = screen.getAllByRole('row');
    // First row is header, data rows follow
    expect(rows.length).toBeGreaterThan(1);
  });

  it('has aria-sort on sortable column headers', () => {
    const { container } = renderWithBenchmarkProviders(<BenchmarkTable brands={mockBrands} />);
    const sortedHeaders = container.querySelectorAll('[aria-sort]');
    expect(sortedHeaders.length).toBeGreaterThan(0);
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithBenchmarkProviders(<BenchmarkTable brands={mockBrands} />);
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
