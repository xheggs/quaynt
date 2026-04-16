import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithAlertProviders } from './test-utils';
import { AlertSeverityBadge } from '../alert-severity-badge';

describe('AlertSeverityBadge', () => {
  it('renders critical severity with correct label', () => {
    renderWithAlertProviders(<AlertSeverityBadge severity="critical" />);
    expect(screen.getByText('Critical')).toBeDefined();
  });

  it('renders warning severity with correct label', () => {
    renderWithAlertProviders(<AlertSeverityBadge severity="warning" />);
    expect(screen.getByText('Warning')).toBeDefined();
  });

  it('renders info severity with correct label', () => {
    renderWithAlertProviders(<AlertSeverityBadge severity="info" />);
    expect(screen.getByText('Info')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithAlertProviders(<AlertSeverityBadge severity="critical" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
