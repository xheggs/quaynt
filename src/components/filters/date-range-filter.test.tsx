import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { DateRangeFilter } from './date-range-filter';

describe('DateRangeFilter', () => {
  it('renders without accessibility violations', async () => {
    const { container } = renderWithProviders(<DateRangeFilter onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows default label when no dates selected', () => {
    const { container } = renderWithProviders(<DateRangeFilter onChange={() => {}} />);
    expect(container.textContent).toContain('Date range');
  });

  it('shows formatted date range when dates are selected', () => {
    const from = new Date(2026, 0, 1);
    const to = new Date(2026, 0, 31);
    const { container } = renderWithProviders(
      <DateRangeFilter from={from} to={to} onChange={() => {}} />
    );
    expect(container.textContent).toContain('2026');
  });

  it('opens popover with presets on click', () => {
    const { container, baseElement } = renderWithProviders(<DateRangeFilter onChange={() => {}} />);
    const trigger = container.querySelector('button')!;
    fireEvent.click(trigger);
    expect(baseElement.textContent).toContain('Last 7 days');
    expect(baseElement.textContent).toContain('Last 30 days');
    expect(baseElement.textContent).toContain('Last 90 days');
  });
});
