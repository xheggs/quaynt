import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';

import { renderWithOnboardingProviders } from './test-utils';
import { StageLoading } from '../review/stage-loading';

afterEach(() => {
  cleanup();
});

describe('StageLoading', () => {
  it('renders the fetching copy with the host inside a font-mono code element', () => {
    const { container } = renderWithOnboardingProviders(
      <StageLoading status="fetching" host="example.com" />
    );
    expect(screen.getByText(/Reading/i)).toBeTruthy();
    const code = container.querySelector('code.font-mono');
    expect(code?.textContent).toBe('example.com');
  });

  it('renders host-less copy when no host is available', () => {
    renderWithOnboardingProviders(<StageLoading status="fetching" host={null} />);
    expect(screen.getByText(/Reading your site/i)).toBeTruthy();
  });

  it('switches copy on the suggesting status', () => {
    renderWithOnboardingProviders(<StageLoading status="suggesting" host="example.com" />);
    expect(screen.getByText(/Analysing your brand and drafting prompts/i)).toBeTruthy();
    expect(screen.queryByText(/Reading/i)).toBeNull();
  });

  it('exposes role="status" with an aria-label so screen readers announce progress', () => {
    renderWithOnboardingProviders(<StageLoading status="pending" host="example.com" />);
    expect(screen.getByRole('status', { name: /Generating suggestions/i })).toBeTruthy();
  });

  describe('elapsed hint', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reveals the elapsed hint after 6 seconds', () => {
      renderWithOnboardingProviders(<StageLoading status="suggesting" host="example.com" />);
      const hint = screen.getByText(/Still working/i);
      // Hidden initially via opacity-0.
      expect(hint.className).toMatch(/opacity-0/);
      act(() => {
        vi.advanceTimersByTime(6_000);
      });
      expect(hint.className).toMatch(/opacity-100/);
    });
  });
});
