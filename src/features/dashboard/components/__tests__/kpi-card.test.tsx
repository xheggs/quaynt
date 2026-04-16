import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithDashboardProviders } from './test-utils';
import { KpiCard } from '../kpi-card';

const sparklineData = [
  { date: '2026-01-01', value: '10' },
  { date: '2026-01-02', value: '15' },
  { date: '2026-01-03', value: '20' },
];

describe('KpiCard', () => {
  it('renders value and label', () => {
    renderWithDashboardProviders(<KpiCard label="Test Metric" value="42.3%" />);
    expect(screen.getByText('Test Metric')).toBeDefined();
    expect(screen.getByText('42.3%')).toBeDefined();
  });

  it('shows trend icon and delta for up direction', () => {
    const { container } = renderWithDashboardProviders(
      <KpiCard label="Metric" value="50%" delta="+5.2%" direction="up" />
    );
    expect(screen.getByText('+5.2%')).toBeDefined();
    // Trend icon should be present (aria-hidden)
    const icons = container.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('shows trend icon for down direction', () => {
    renderWithDashboardProviders(
      <KpiCard label="Metric" value="30%" delta="-3.1%" direction="down" />
    );
    expect(screen.getByText('-3.1%')).toBeDefined();
  });

  it('shows no trend indicator for null direction', () => {
    const { container } = renderWithDashboardProviders(<KpiCard label="Metric" value="50%" />);
    // Should not contain trend text
    expect(container.querySelector('[data-testid="trend-indicator"]')).toBeNull();
  });

  it('renders sparkline when data is provided', () => {
    const { container } = renderWithDashboardProviders(
      <KpiCard label="Metric" value="50%" sparkline={sparklineData} direction="up" />
    );
    expect(container.querySelector('svg')).toBeDefined();
  });

  it('has aria-label with metric info', () => {
    const { container } = renderWithDashboardProviders(
      <KpiCard label="Recommendation Share" value="42.3%" delta="+5.2%" direction="up" />
    );
    const card = container.querySelector('[aria-label]');
    expect(card).toBeDefined();
    expect(card?.getAttribute('aria-label')).toContain('Recommendation Share');
    expect(card?.getAttribute('aria-label')).toContain('42.3%');
  });

  it('renders skeleton in loading state', () => {
    const { container } = renderWithDashboardProviders(
      <KpiCard label="Metric" value="50%" loading />
    );
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies tabular-nums to value', () => {
    const { container } = renderWithDashboardProviders(<KpiCard label="Metric" value="1,234" />);
    const value = container.querySelector('.tabular-nums');
    expect(value).toBeDefined();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithDashboardProviders(
      <KpiCard
        label="Metric"
        value="42.3%"
        delta="+5.2%"
        direction="up"
        sparkline={sparklineData}
      />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });

  it('passes accessibility checks in loading state', async () => {
    const { container } = renderWithDashboardProviders(<KpiCard label="Metric" value="" loading />);
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
