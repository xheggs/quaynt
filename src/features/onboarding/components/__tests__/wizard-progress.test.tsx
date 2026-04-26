import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import onboardingMessages from '../../../../../locales/en/onboarding.json';

const messages = { ...onboardingMessages };

const usePathnameMock = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

import { WizardProgress } from '../wizard-progress';

function renderAt(pathname: string) {
  usePathnameMock.mockReturnValue(pathname);
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WizardProgress />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  cleanup();
  usePathnameMock.mockReset();
});

describe('WizardProgress (path-derived)', () => {
  it('renders 33 on /onboarding/welcome', () => {
    const { container } = renderAt('/en/onboarding/welcome');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '33'
    );
  });

  it('renders 66 on /onboarding/review/<id>', () => {
    const { container } = renderAt('/en/onboarding/review/job_abc');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '66'
    );
  });

  it('renders 100 on /onboarding/first-run/<id>', () => {
    const { container } = renderAt('/en/onboarding/first-run/run_abc');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '100'
    );
  });

  it('renders 40 on the manual /onboarding/brand', () => {
    const { container } = renderAt('/en/onboarding/brand');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '40'
    );
  });

  it('renders 60 on the manual /onboarding/competitors', () => {
    const { container } = renderAt('/en/onboarding/competitors');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '60'
    );
  });

  it('renders 80 on the manual /onboarding/prompt-set', () => {
    const { container } = renderAt('/en/onboarding/prompt-set');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '80'
    );
  });

  it('renders nothing for unrecognised paths', () => {
    const { container } = renderAt('/en/dashboard');
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});
