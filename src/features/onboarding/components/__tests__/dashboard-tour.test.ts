import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DASHBOARD_TOUR_STEPS } from '../dashboard-tour';

const driveSpy = vi.fn();
const driverFactory = vi.fn().mockReturnValue({ drive: driveSpy });

vi.mock('driver.js', () => ({
  driver: (...args: unknown[]) => driverFactory(...args),
}));
vi.mock('driver.js/dist/driver.css', () => ({}));

describe('DASHBOARD_TOUR_STEPS', () => {
  it('targets the six expected data-tour anchors in order', () => {
    expect(DASHBOARD_TOUR_STEPS.map((s) => s.slug)).toEqual([
      'kpis',
      'opportunities',
      'alerts',
      'brands',
      'settings',
      'help',
    ]);

    expect(DASHBOARD_TOUR_STEPS.map((s) => s.selector)).toEqual([
      '[data-tour="dashboard-kpis"]',
      '[data-tour="dashboard-opportunities"]',
      '[data-tour="dashboard-alerts"]',
      '[data-tour="nav-brands"]',
      '[data-tour="nav-settings"]',
      '[data-tour="header-help"]',
    ]);
  });
});

describe('runDashboardTour', () => {
  beforeEach(() => {
    driverFactory.mockClear();
    driveSpy.mockClear();
  });

  it('configures driver.js with all six steps and calls drive()', async () => {
    const { runDashboardTour } = await import('../dashboard-tour');
    await runDashboardTour({
      steps: DASHBOARD_TOUR_STEPS.map((s) => ({
        selector: s.selector,
        title: `Title for ${s.slug}`,
        body: `Body for ${s.slug}`,
      })),
      controls: { next: 'Next', prev: 'Back', done: 'Done', close: 'Close' },
      onComplete: vi.fn(),
      prefersReducedMotion: false,
    });

    expect(driverFactory).toHaveBeenCalledTimes(1);
    expect(driveSpy).toHaveBeenCalledTimes(1);
    const config = driverFactory.mock.calls[0]?.[0] as Record<string, unknown>;
    const steps = config.steps as Array<{ element: string }>;
    expect(steps).toHaveLength(6);
    expect(steps[0]?.element).toBe('[data-tour="dashboard-kpis"]');
    expect(steps[5]?.element).toBe('[data-tour="header-help"]');
    expect(config.animate).toBe(true);
  });

  it('disables animation when prefers-reduced-motion', async () => {
    const { runDashboardTour } = await import('../dashboard-tour');
    await runDashboardTour({
      steps: DASHBOARD_TOUR_STEPS.map((s) => ({
        selector: s.selector,
        title: 'x',
        body: 'y',
      })),
      controls: { next: 'Next', prev: 'Back', done: 'Done', close: 'Close' },
      onComplete: vi.fn(),
      prefersReducedMotion: true,
    });
    const config = driverFactory.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config.animate).toBe(false);
  });
});
