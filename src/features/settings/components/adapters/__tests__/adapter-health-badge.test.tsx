import { afterEach, describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { AdapterHealthBadge } from '../adapter-health-badge';

describe('AdapterHealthBadge', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders healthy status', () => {
    renderWithProviders(<AdapterHealthBadge status="healthy" />);
    expect(screen.getByText('Healthy')).toBeDefined();
  });

  it('renders degraded status', () => {
    renderWithProviders(<AdapterHealthBadge status="degraded" />);
    expect(screen.getByText('Degraded')).toBeDefined();
  });

  it('renders unhealthy status', () => {
    renderWithProviders(<AdapterHealthBadge status="unhealthy" />);
    expect(screen.getByText('Unhealthy')).toBeDefined();
  });

  it('renders unknown status when null', () => {
    renderWithProviders(<AdapterHealthBadge status={null} />);
    expect(screen.getByText('Unknown')).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithProviders(<AdapterHealthBadge status="healthy" />);
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
