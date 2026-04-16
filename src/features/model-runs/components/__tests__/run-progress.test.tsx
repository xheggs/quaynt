import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithRunProviders } from './test-utils';
import { RunProgress } from '../run-progress';
import type { ResultSummary } from '../../model-run.types';

const mockSummary: ResultSummary = {
  total: 24,
  completed: 10,
  failed: 2,
  pending: 8,
  running: 2,
  skipped: 2,
};

describe('RunProgress', () => {
  it('renders compact variant with fraction text', () => {
    const { container } = renderWithRunProviders(
      <RunProgress resultSummary={mockSummary} variant="compact" />
    );
    // done = completed + failed + skipped = 14
    expect(container.textContent).toContain('14');
    expect(container.textContent).toContain('24');
  });

  it('renders full variant with breakdown counts', () => {
    const { container } = renderWithRunProviders(
      <RunProgress resultSummary={mockSummary} variant="full" />
    );
    expect(container.textContent).toContain('10 completed');
    expect(container.textContent).toContain('2 failed');
    expect(container.textContent).toContain('2 skipped');
  });

  it('renders progress bar with correct aria attributes', () => {
    const { container } = renderWithRunProviders(<RunProgress resultSummary={mockSummary} />);
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).toBeDefined();
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('24');
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('14');
  });

  it('renders full variant with percentage', () => {
    const { container } = renderWithRunProviders(
      <RunProgress resultSummary={mockSummary} variant="full" />
    );
    // 14/24 ≈ 58%
    expect(container.textContent).toContain('58%');
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithRunProviders(
      <RunProgress resultSummary={mockSummary} variant="full" />
    );
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
