import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { DataTablePagination } from './data-table-pagination';

describe('DataTablePagination', () => {
  const defaultProps = {
    page: 1,
    limit: 25,
    total: 100,
    onPageChange: vi.fn(),
    onLimitChange: vi.fn(),
  };

  it('renders without accessibility violations', async () => {
    const { container } = renderWithProviders(<DataTablePagination {...defaultProps} />);
    expect(
      await axe(container, {
        rules: {
          'color-contrast': { enabled: false },
          'nested-interactive': { enabled: false },
        },
      })
    ).toHaveNoViolations();
  });

  it('shows range summary with total', () => {
    const { container } = renderWithProviders(<DataTablePagination {...defaultProps} />);
    const text = container.textContent ?? '';
    expect(text).toContain('1');
    expect(text).toContain('25');
    expect(text).toContain('100');
  });

  it('disables first/prev buttons on first page', () => {
    const { container } = renderWithProviders(<DataTablePagination {...defaultProps} page={1} />);
    const buttons = container.querySelectorAll('button');
    // First two navigation buttons should be disabled (First, Previous)
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it('disables next/last buttons on last page', () => {
    const { container } = renderWithProviders(
      <DataTablePagination {...defaultProps} page={4} total={100} />
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    // Find the last two navigation buttons (Next, Last) — before the page size select
    const navButtons = buttons.filter((b) => b.getAttribute('aria-label')?.includes('page'));
    const lastBtn = navButtons.find((b) => b.getAttribute('aria-label') === 'Last page');
    const nextBtn = navButtons.find((b) => b.getAttribute('aria-label') === 'Next page');
    expect(lastBtn?.disabled).toBe(true);
    expect(nextBtn?.disabled).toBe(true);
  });

  it('calls onPageChange when next is clicked', () => {
    const onPageChange = vi.fn();
    const { container } = renderWithProviders(
      <DataTablePagination {...defaultProps} onPageChange={onPageChange} />
    );
    const nextBtn = container.querySelector('[aria-label="Next page"]') as HTMLButtonElement;
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('shows zero range for empty data', () => {
    const { container } = renderWithProviders(<DataTablePagination {...defaultProps} total={0} />);
    const text = container.textContent ?? '';
    expect(text).toContain('0');
  });
});
