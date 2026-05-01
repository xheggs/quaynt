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

function activeStepText(container: HTMLElement): string | null {
  const active = container.querySelector('[aria-current="step"]');
  return active ? active.textContent : null;
}

describe('WizardProgress (path-derived)', () => {
  it('marks Connect active on /onboarding/welcome', () => {
    const { container } = renderAt('/en/onboarding/welcome');
    expect(activeStepText(container)).toContain('Connect');
  });

  it('marks Confirm active on /onboarding/review/<id>', () => {
    const { container } = renderAt('/en/onboarding/review/job_abc');
    expect(activeStepText(container)).toContain('Confirm');
  });

  it('marks Compare active on /onboarding/first-run/<id>', () => {
    const { container } = renderAt('/en/onboarding/first-run/run_abc');
    expect(activeStepText(container)).toContain('Compare');
  });

  it('renders nothing for legacy manual-flow paths (no longer part of the flow)', () => {
    expect(renderAt('/en/onboarding/brand').container.querySelector('nav')).toBeNull();
    cleanup();
    expect(renderAt('/en/onboarding/competitors').container.querySelector('nav')).toBeNull();
    cleanup();
    expect(renderAt('/en/onboarding/prompt-set').container.querySelector('nav')).toBeNull();
  });

  it('does not render an "N of N" counter inside the chip rail', () => {
    const { container } = renderAt('/en/onboarding/welcome');
    expect(container.textContent ?? '').not.toMatch(/\d\s*of\s*\d/i);
  });

  it('renders nothing for unrecognised paths', () => {
    const { container } = renderAt('/en/dashboard');
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders Connect/Confirm/Compare labels on every onboarding page', () => {
    const { container } = renderAt('/en/onboarding/welcome');
    const text = container.textContent ?? '';
    expect(text).toContain('Connect');
    expect(text).toContain('Confirm');
    expect(text).toContain('Compare');
  });
});
