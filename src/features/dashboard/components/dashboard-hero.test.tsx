import { afterEach, describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';

import { renderWithDashboardProviders } from './__tests__/test-utils';
import { DashboardHero } from './dashboard-hero';

afterEach(() => {
  cleanup();
});

describe('DashboardHero', () => {
  it('renders an h1 with the welcome title', () => {
    renderWithDashboardProviders(<DashboardHero brandCount={4} promptSetCount={2} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Welcome back.');
  });

  it('swaps the title in empty mode', () => {
    renderWithDashboardProviders(<DashboardHero empty />);
    const heading = screen.getByRole('heading', { level: 1 });
    // Empty workspace title comes from header.emptyWelcome.
    expect(heading.textContent).toBeTruthy();
    expect(heading.textContent).not.toBe('Welcome back.');
  });

  it('omits the status strip when no metadata is provided and not empty', () => {
    const { container } = renderWithDashboardProviders(<DashboardHero />);
    // Status strip is the divider rule + chip row; absent when no metadata.
    const ruleSeparator = container.querySelector('span.h-px.w-12.bg-border');
    expect(ruleSeparator).toBeNull();
  });

  it('renders the status strip when given brand/prompt-set counts', () => {
    const { container } = renderWithDashboardProviders(
      <DashboardHero brandCount={3} promptSetCount={1} dataAsOf="2026-04-10T12:00:00Z" />
    );
    const ruleSeparator = container.querySelector('span.h-px.w-12.bg-border');
    expect(ruleSeparator).not.toBeNull();
  });

  it('marks the dot separators and rule as aria-hidden', () => {
    const { container } = renderWithDashboardProviders(
      <DashboardHero brandCount={3} promptSetCount={1} />
    );
    // Every middle-dot span between chips should be aria-hidden.
    const dots = Array.from(container.querySelectorAll('span')).filter(
      (el) => el.textContent === '·'
    );
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(dot.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithDashboardProviders(
      <DashboardHero
        brandCount={4}
        promptSetCount={2}
        promptSetName="Default"
        dataAsOf="2026-04-10T12:00:00Z"
      />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });

  it('renders without accessibility violations in empty state', async () => {
    const { container } = renderWithDashboardProviders(<DashboardHero empty />);
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
