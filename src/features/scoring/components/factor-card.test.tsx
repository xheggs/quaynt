import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { FactorCard, type ScoringFactorView } from './factor-card';

afterEach(() => {
  cleanup();
});

function view(overrides: Partial<ScoringFactorView> = {}): ScoringFactorView {
  return {
    id: 'citation_frequency',
    score: 72,
    weight: 25,
    status: 'active',
    name: 'Citation Frequency',
    description: 'How often the brand is cited',
    weightLabel: 'Weight: 25%',
    statusLabel: 'Active',
    hint: null,
    ...overrides,
  };
}

describe('FactorCard', () => {
  it('renders name, description, weight label, and rounded score', () => {
    const { getByText } = render(<FactorCard factor={view({ score: 72.4 })} />);
    expect(getByText('Citation Frequency')).toBeDefined();
    expect(getByText('How often the brand is cited')).toBeDefined();
    expect(getByText('Weight: 25%')).toBeDefined();
    expect(getByText('72')).toBeDefined();
    expect(getByText('Active')).toBeDefined();
  });

  it('renders em-dash when score is null', () => {
    const { getByText } = render(
      <FactorCard
        factor={view({ score: null, status: 'insufficientData', statusLabel: 'Insufficient data' })}
      />
    );
    expect(getByText('—')).toBeDefined();
    expect(getByText('Insufficient data')).toBeDefined();
  });

  it('renders hint text when provided', () => {
    const { getByText } = render(
      <FactorCard
        factor={view({
          status: 'notYetScored',
          statusLabel: 'Not yet scored',
          hint: 'Accuracy tracking ships in v2',
        })}
      />
    );
    expect(getByText('Accuracy tracking ships in v2')).toBeDefined();
  });

  it('omits hint node when hint is null', () => {
    const { queryByText } = render(<FactorCard factor={view({ hint: null })} />);
    expect(queryByText('Accuracy tracking ships in v2')).toBeNull();
  });

  it('progressbar aria attributes reflect the score', () => {
    const { container } = render(<FactorCard factor={view({ score: 42 })} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('42');
    expect(bar?.getAttribute('aria-valuemin')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('100');
  });
});
