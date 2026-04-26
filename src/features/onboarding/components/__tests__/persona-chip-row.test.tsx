import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, fireEvent, screen } from '@testing-library/react';

import { renderWithOnboardingProviders } from './test-utils';

const updateMutateMock = vi.fn();
vi.mock('@/features/onboarding/hooks/use-onboarding', () => ({
  useOnboarding: () => ({ data: undefined }),
  useUpdateOnboarding: () => ({
    mutate: updateMutateMock,
    isPending: false,
  }),
}));

import { PersonaChipRow } from '../persona-chip-row';

afterEach(() => {
  cleanup();
  updateMutateMock.mockReset();
});

describe('PersonaChipRow', () => {
  it('renders a single radiogroup with five chips', () => {
    renderWithOnboardingProviders(<PersonaChipRow currentRole={null} />);
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('marks the currentRole chip as aria-checked on first render', () => {
    renderWithOnboardingProviders(<PersonaChipRow currentRole="seo" />);
    const seo = screen.getByRole('radio', { name: 'SEO / GEO' });
    expect(seo.getAttribute('aria-checked')).toBe('true');
  });

  it('flips aria-checked optimistically on click before the mutation resolves', () => {
    renderWithOnboardingProviders(<PersonaChipRow currentRole={null} />);
    const founder = screen.getByRole('radio', { name: 'Founder' });
    expect(founder.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(founder);
    expect(founder.getAttribute('aria-checked')).toBe('true');
    expect(updateMutateMock).toHaveBeenCalledWith({ roleHint: 'founder' }, expect.any(Object));
  });

  it('passes axe a11y checks', async () => {
    const { container } = renderWithOnboardingProviders(<PersonaChipRow currentRole="marketing" />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
