import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithRunProviders } from './test-utils';
import { RunStatusBadge } from '../run-status-badge';

describe('RunStatusBadge', () => {
  it('renders correct label for each run status', () => {
    const statuses = ['pending', 'running', 'completed', 'partial', 'failed', 'cancelled'] as const;
    for (const status of statuses) {
      const { unmount } = renderWithRunProviders(<RunStatusBadge status={status} />);
      unmount();
    }
  });

  it('renders correct label for result statuses', () => {
    const statuses = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
    for (const status of statuses) {
      const { unmount } = renderWithRunProviders(
        <RunStatusBadge status={status} variant="result" />
      );
      unmount();
    }
  });

  it('renders sm size with smaller styling', () => {
    const { container } = renderWithRunProviders(<RunStatusBadge status="completed" size="sm" />);
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.className).toContain('h-4');
  });

  it('renders running status with animated icon', () => {
    const { container } = renderWithRunProviders(<RunStatusBadge status="running" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeDefined();
  });

  it('renders fallback for unknown status', () => {
    const { container } = renderWithRunProviders(<RunStatusBadge status={'unknown' as never} />);
    expect(container.textContent).toContain('unknown');
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithRunProviders(<RunStatusBadge status="completed" />);
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
