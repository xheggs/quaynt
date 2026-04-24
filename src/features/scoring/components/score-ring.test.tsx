import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ScoreRing } from './score-ring';

afterEach(() => {
  cleanup();
});

describe('ScoreRing', () => {
  it('renders the rounded composite when a value is provided', () => {
    const { container, getByText } = render(
      <ScoreRing value={74.6} outOfLabel="out of 100" ariaLabel="GEO Score 75 out of 100" />
    );
    expect(getByText('75')).toBeDefined();
    expect(getByText('out of 100')).toBeDefined();
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'GEO Score 75 out of 100'
    );
  });

  it('renders an em-dash when value is null', () => {
    const { getByText } = render(
      <ScoreRing value={null} outOfLabel="out of 100" ariaLabel="No score" />
    );
    expect(getByText('—')).toBeDefined();
  });

  it('renders the cap badge when capped and capLabel provided', () => {
    const { getByText } = render(
      <ScoreRing
        value={82}
        capped
        capLabel="Core factors only"
        capTooltip="Accuracy not yet measured"
        outOfLabel="out of 100"
        ariaLabel="82"
      />
    );
    expect(getByText('Core factors only')).toBeDefined();
  });

  it('omits the cap badge when capped is true but capLabel is missing', () => {
    const { queryByText } = render(
      <ScoreRing value={82} capped outOfLabel="out of 100" ariaLabel="82" />
    );
    expect(queryByText('Core factors only')).toBeNull();
  });

  it('renders positive delta with + prefix', () => {
    const { getByText } = render(
      <ScoreRing value={50} delta={3} outOfLabel="out of 100" ariaLabel="50" />
    );
    expect(getByText('+3')).toBeDefined();
  });

  it('renders negative delta without + prefix', () => {
    const { getByText } = render(
      <ScoreRing value={50} delta={-2} outOfLabel="out of 100" ariaLabel="50" />
    );
    expect(getByText('-2')).toBeDefined();
  });

  it('does not render delta node when delta is null or undefined', () => {
    const { queryByText } = render(
      <ScoreRing value={50} delta={null} outOfLabel="out of 100" ariaLabel="50" />
    );
    expect(queryByText('+0')).toBeNull();
    expect(queryByText('0')).toBeNull();
  });
});
