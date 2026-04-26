'use client';

/**
 * Driver.js-powered replayable dashboard tour.
 *
 * Driver itself is loaded only when `runDashboardTour` is called, keeping
 * its bundle (~5 KB gzipped) out of the dashboard initial chunk. The tour
 * is never auto-played — it ships only via the help-menu trigger in the
 * top nav.
 *
 * Selectors target `data-tour="..."` attributes co-located with the
 * dashboard layout and nav so the tour does not depend on brittle css
 * paths.
 */

interface RunDashboardTourOptions {
  /** Translated step copy keyed by step slug. */
  steps: TourStepCopy[];
  /** Translated UI strings used by the driver controls. */
  controls: TourControlsCopy;
  /** Fired when the tour completes (final next) or is dismissed. */
  onComplete: () => void;
  /** Override for tests. */
  prefersReducedMotion?: boolean;
}

export interface TourStepCopy {
  selector: string;
  title: string;
  body: string;
}

export interface TourControlsCopy {
  next: string;
  prev: string;
  done: string;
  close: string;
}

export const DASHBOARD_TOUR_STEPS = [
  { slug: 'kpis', selector: '[data-tour="dashboard-kpis"]' },
  { slug: 'opportunities', selector: '[data-tour="dashboard-opportunities"]' },
  { slug: 'alerts', selector: '[data-tour="dashboard-alerts"]' },
  { slug: 'brands', selector: '[data-tour="nav-brands"]' },
  { slug: 'settings', selector: '[data-tour="nav-settings"]' },
  { slug: 'help', selector: '[data-tour="header-help"]' },
] as const;

export type DashboardTourSlug = (typeof DASHBOARD_TOUR_STEPS)[number]['slug'];

export async function runDashboardTour(options: RunDashboardTourOptions): Promise<void> {
  // Dynamic import: driver.js stays out of the dashboard initial chunk.
  const [{ driver }] = await Promise.all([
    import('driver.js'),
    import('driver.js/dist/driver.css'),
  ]);

  const reduce =
    options.prefersReducedMotion ??
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const instance = driver({
    showProgress: true,
    animate: !reduce,
    nextBtnText: options.controls.next,
    prevBtnText: options.controls.prev,
    doneBtnText: options.controls.done,
    progressText: '{{current}} / {{total}}',
    onDestroyed: () => {
      options.onComplete();
    },
    steps: options.steps.map((step) => ({
      element: step.selector,
      popover: {
        title: step.title,
        description: step.body,
      },
    })),
  });

  instance.drive();
}
