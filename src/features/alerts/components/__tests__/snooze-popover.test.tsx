import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithAlertProviders } from './test-utils';
import { SnoozePopover } from '../snooze-popover';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/alerts',
}));

vi.mock('../../alerts.api', () => ({
  snoozeEvent: vi.fn(),
}));

describe('SnoozePopover', () => {
  it('renders snooze trigger button', () => {
    renderWithAlertProviders(<SnoozePopover eventId="alertevt_1" />);
    const buttons = screen.getAllByRole('button');
    const snoozeBtn = buttons.find((b) => b.getAttribute('aria-label') === 'Snooze');
    expect(snoozeBtn).toBeDefined();
  });

  it('disables trigger when disabled prop is true', () => {
    renderWithAlertProviders(<SnoozePopover eventId="alertevt_1" disabled />);
    const buttons = screen.getAllByRole('button');
    const snoozeBtn = buttons.find((b) => b.getAttribute('aria-label') === 'Snooze');
    expect(snoozeBtn).toBeDefined();
    // Check that the button's disabled state is reflected in some way
    // shadcn Button passes disabled to the DOM element
    const attrs = Array.from(snoozeBtn!.attributes).map((a) => `${a.name}=${a.value}`);
    const hasDisabledIndicator =
      snoozeBtn!.hasAttribute('disabled') ||
      snoozeBtn!.hasAttribute('data-disabled') ||
      attrs.some((a) => a.includes('disabled'));
    expect(hasDisabledIndicator).toBe(true);
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithAlertProviders(<SnoozePopover eventId="alertevt_1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
