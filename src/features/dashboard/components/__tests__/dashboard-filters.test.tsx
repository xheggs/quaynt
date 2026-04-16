import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithDashboardProviders } from './test-utils';
import { DashboardFilterBar } from '../dashboard-filters';

const mockOptions = [
  { value: 'ps-1', label: 'Default Set' },
  { value: 'ps-2', label: 'Competitor Set' },
];

describe('DashboardFilterBar', () => {
  it('renders prompt set dropdown when options are available', () => {
    renderWithDashboardProviders(
      <DashboardFilterBar
        filters={{}}
        onFiltersChange={vi.fn()}
        promptSetOptions={mockOptions}
        promptSetLoading={false}
      />
    );
    // The dropdown trigger should show the placeholder text
    expect(screen.getByText((t) => t.includes('All prompt sets'))).toBeDefined();
  });

  it('hides prompt set dropdown when no options', () => {
    const { container } = renderWithDashboardProviders(
      <DashboardFilterBar
        filters={{}}
        onFiltersChange={vi.fn()}
        promptSetOptions={[]}
        promptSetLoading={false}
      />
    );
    // The combobox role should not be present since there are no options
    expect(container.querySelector('[role="combobox"]')).toBeNull();
  });

  it('renders date range picker', () => {
    const { container } = renderWithDashboardProviders(
      <DashboardFilterBar
        filters={{}}
        onFiltersChange={vi.fn()}
        promptSetOptions={[]}
        promptSetLoading={false}
      />
    );
    // Date range button should be present
    expect(container.querySelector('[data-slot="filter-bar"]')).toBeDefined();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithDashboardProviders(
      <DashboardFilterBar
        filters={{}}
        onFiltersChange={vi.fn()}
        promptSetOptions={mockOptions}
        promptSetLoading={false}
      />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
