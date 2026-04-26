import { afterEach, describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';

import { renderWithOnboardingProviders } from './test-utils';
import { KpiPlaceholder } from '../kpi-placeholder';

afterEach(() => cleanup());

describe('KpiPlaceholder', () => {
  it('shows the computing affordance while non-terminal', () => {
    renderWithOnboardingProviders(
      <KpiPlaceholder kind="citation-count" terminal={false} terminalKind={null} earnedCount={0} />
    );
    expect(screen.getByText(/Computing/i)).toBeDefined();
  });

  it('shows the live value when terminal with earned citations', () => {
    renderWithOnboardingProviders(
      <KpiPlaceholder
        kind="citation-count"
        terminal={true}
        terminalKind="completed"
        earnedCount={4}
      />
    );
    expect(screen.getByText('4')).toBeDefined();
  });

  it('shows the empty copy on terminal with zero citations', () => {
    renderWithOnboardingProviders(
      <KpiPlaceholder
        kind="citation-count"
        terminal={true}
        terminalKind="completed"
        earnedCount={0}
      />
    );
    expect(screen.queryByText(/Computing/i)).toBeNull();
    expect(screen.getByText(/No third-party citations/i)).toBeDefined();
  });

  it('shows the error copy on failed runs', () => {
    renderWithOnboardingProviders(
      <KpiPlaceholder kind="citation-count" terminal={true} terminalKind="failed" earnedCount={0} />
    );
    expect(screen.queryByText(/Computing/i)).toBeNull();
  });

  it('shows the error copy on cancelled runs', () => {
    renderWithOnboardingProviders(
      <KpiPlaceholder
        kind="citation-count"
        terminal={true}
        terminalKind="cancelled"
        earnedCount={0}
      />
    );
    expect(screen.queryByText(/Computing/i)).toBeNull();
  });

  it('has no a11y violations across all states', async () => {
    const { container } = renderWithOnboardingProviders(
      <>
        <KpiPlaceholder
          kind="recommendation-share"
          terminal={false}
          terminalKind={null}
          earnedCount={0}
        />
        <KpiPlaceholder
          kind="citation-count"
          terminal={true}
          terminalKind="completed"
          earnedCount={3}
        />
        <KpiPlaceholder kind="sentiment" terminal={true} terminalKind="failed" earnedCount={0} />
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
