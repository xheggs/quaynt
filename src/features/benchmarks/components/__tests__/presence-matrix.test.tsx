import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithBenchmarkProviders } from './test-utils';
import { PresenceMatrix } from '../presence-matrix';
import type { PresenceMatrixRow } from '../../benchmark.types';

const mockRows: PresenceMatrixRow[] = [
  {
    promptId: 'p1',
    promptText: 'Best project management tools for remote teams',
    brands: [
      { brandId: '1', brandName: 'Acme', present: true, citationCount: 3 },
      { brandId: '2', brandName: 'Beta', present: false, citationCount: 0 },
    ],
  },
  {
    promptId: 'p2',
    promptText: 'Top collaboration software 2026',
    brands: [
      { brandId: '1', brandName: 'Acme', present: true, citationCount: 1 },
      { brandId: '2', brandName: 'Beta', present: true, citationCount: 2 },
    ],
  },
];

describe('PresenceMatrix', () => {
  it('renders prompt x brand grid', () => {
    renderWithBenchmarkProviders(
      <PresenceMatrix
        data={{ rows: mockRows, total: 2 }}
        page={1}
        onPageChange={vi.fn()}
        brandNames={['Acme', 'Beta']}
      />
    );
    const table = screen.getByTestId('presence-matrix');
    expect(table).toBeDefined();
    expect(screen.getByText('Best project management tools for remote teams')).toBeDefined();
    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.getByText('Beta')).toBeDefined();
  });

  it('shows present/absent cells with aria-labels', () => {
    const { container } = renderWithBenchmarkProviders(
      <PresenceMatrix
        data={{ rows: mockRows, total: 2 }}
        page={1}
        onPageChange={vi.fn()}
        brandNames={['Acme', 'Beta']}
      />
    );
    // Cells should have aria-label attributes
    const cellsWithLabel = container.querySelectorAll('[aria-label]');
    expect(cellsWithLabel.length).toBeGreaterThan(0);
  });

  it('shows pagination when total exceeds page size', () => {
    renderWithBenchmarkProviders(
      <PresenceMatrix
        data={{ rows: mockRows, total: 50 }}
        page={1}
        onPageChange={vi.fn()}
        brandNames={['Acme', 'Beta']}
      />
    );
    expect(screen.getByText('Previous page')).toBeDefined();
    expect(screen.getByText('Next page')).toBeDefined();
  });

  it('calls onPageChange when pagination buttons clicked', () => {
    const onPageChange = vi.fn();
    const { container } = renderWithBenchmarkProviders(
      <PresenceMatrix
        data={{ rows: mockRows, total: 50 }}
        page={1}
        onPageChange={onPageChange}
        brandNames={['Acme', 'Beta']}
      />
    );
    const nextBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Next page'
    );
    expect(nextBtn).toBeDefined();
    fireEvent.click(nextBtn!);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('returns nothing for empty data', () => {
    const { container } = renderWithBenchmarkProviders(
      <PresenceMatrix data={undefined} page={1} onPageChange={vi.fn()} brandNames={[]} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithBenchmarkProviders(
      <PresenceMatrix
        data={{ rows: mockRows, total: 2 }}
        page={1}
        onPageChange={vi.fn()}
        brandNames={['Acme', 'Beta']}
      />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
