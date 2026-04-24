import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { FactorGrid } from './factor-grid';

afterEach(() => {
  cleanup();
});
import type { ScoringFactorView } from './factor-card';

function factor(id: string, overrides: Partial<ScoringFactorView> = {}): ScoringFactorView {
  return {
    id,
    score: 60,
    weight: 25,
    status: 'active',
    name: `Factor ${id}`,
    description: '',
    weightLabel: 'Weight: 25%',
    statusLabel: 'Active',
    hint: null,
    ...overrides,
  };
}

describe('FactorGrid', () => {
  it('renders one card per factor', () => {
    const factors = ['a', 'b', 'c', 'd'].map((id) => factor(id));
    const { getByText } = render(<FactorGrid factors={factors} />);
    for (const f of factors) {
      expect(getByText(f.name)).toBeDefined();
    }
  });

  it('applies the 4-column class when columns=4', () => {
    const { container } = render(<FactorGrid factors={[factor('a')]} columns={4} />);
    expect(container.firstElementChild?.className).toContain('lg:grid-cols-4');
  });

  it('applies the 3-column class by default', () => {
    const { container } = render(<FactorGrid factors={[factor('a')]} />);
    expect(container.firstElementChild?.className).toContain('lg:grid-cols-3');
  });

  it('applies the 2-column class when columns=2', () => {
    const { container } = render(<FactorGrid factors={[factor('a')]} columns={2} />);
    const cls = container.firstElementChild?.className ?? '';
    expect(cls).toContain('sm:grid-cols-2');
    expect(cls).not.toContain('lg:grid-cols-3');
    expect(cls).not.toContain('lg:grid-cols-4');
  });
});
