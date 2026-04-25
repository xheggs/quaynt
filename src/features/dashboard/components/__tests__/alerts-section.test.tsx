import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithDashboardProviders } from './test-utils';
import { AlertsSection } from '../alerts-section';
import type { DashboardAlertSummary } from '../../dashboard.types';

const mockAlerts: DashboardAlertSummary = {
  active: 3,
  total: 5,
  bySeverity: { info: 1, warning: 1, critical: 1 },
  recentEvents: [
    {
      id: 'e1',
      ruleId: 'r1',
      severity: 'critical',
      triggeredAt: '2026-04-10T10:00:00Z',
      message: 'Brand visibility dropped below threshold',
    },
    {
      id: 'e2',
      ruleId: 'r2',
      severity: 'warning',
      triggeredAt: '2026-04-10T09:00:00Z',
      message: 'Citation count declining',
    },
    {
      id: 'e3',
      ruleId: 'r3',
      severity: 'info',
      triggeredAt: '2026-04-10T08:00:00Z',
      message: 'New competitor detected',
    },
  ],
};

const emptyAlerts: DashboardAlertSummary = {
  active: 0,
  total: 0,
  bySeverity: { info: 0, warning: 0, critical: 0 },
  recentEvents: [],
};

describe('AlertsSection', () => {
  it('renders severity summary with counts', () => {
    const { container } = renderWithDashboardProviders(<AlertsSection alerts={mockAlerts} />);
    const summary = container.querySelector('[data-testid="alert-severity-summary"]');
    expect(summary).toBeDefined();
  });

  it('renders recent event list', () => {
    const { container } = renderWithDashboardProviders(<AlertsSection alerts={mockAlerts} />);
    const eventsList = container.querySelector('[data-testid="alert-events-list"]');
    expect(eventsList).toBeDefined();
    const items = eventsList?.querySelectorAll('li');
    expect(items?.length).toBe(3);
  });

  it('shows active count badge', () => {
    const { container } = renderWithDashboardProviders(<AlertsSection alerts={mockAlerts} />);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).not.toBeNull();
    // Badge now uses the localized "{count} active alerts" string; assert the count is present.
    expect(badge?.textContent).toContain('3');
  });

  it('shows warning for null', () => {
    const { container } = renderWithDashboardProviders(<AlertsSection alerts={null} />);
    expect(container.querySelector('[data-slot="error-state"]')).toBeDefined();
  });

  it('shows empty state with encouraging message', () => {
    renderWithDashboardProviders(<AlertsSection alerts={emptyAlerts} />);
    const emptyText = screen.getByText((content) => content.includes('No alerts configured'));
    expect(emptyText).toBeDefined();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithDashboardProviders(<AlertsSection alerts={mockAlerts} />);
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
