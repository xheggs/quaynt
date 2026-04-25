import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { StatBlock } from './stat-block';

describe('StatBlock', () => {
  it('renders label and value', () => {
    const { getByText } = render(<StatBlock label="Citations" value="1,204" />);
    expect(getByText('Citations')).toBeDefined();
    expect(getByText('1,204')).toBeDefined();
  });

  it('picks the right trend icon for each direction', () => {
    const { container, rerender } = render(
      <StatBlock label="Up" value="100" direction="up" delta="+10" />
    );
    expect(container.querySelector('.lucide-trending-up')).not.toBeNull();

    rerender(<StatBlock label="Down" value="100" direction="down" delta="-10" />);
    expect(container.querySelector('.lucide-trending-down')).not.toBeNull();

    rerender(<StatBlock label="Stable" value="100" direction="stable" delta="0" />);
    expect(container.querySelector('.lucide-minus')).not.toBeNull();
  });

  it('applies aria-label when provided', () => {
    const { container } = render(
      <StatBlock label="Citations" value="1,204" ariaLabel="Citations 1,204 up 12%" />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-label')).toBe('Citations 1,204 up 12%');
  });

  it('renders the sparkline only when data is provided', () => {
    const { container, rerender } = render(<StatBlock label="x" value="1" />);
    expect(container.querySelector('svg')).toBeNull();

    rerender(
      <StatBlock
        label="x"
        value="1"
        sparkline={[
          { date: '2026-04-01', value: '1' },
          { date: '2026-04-02', value: '2' },
        ]}
      />
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <StatBlock
        label="Total citations"
        value="1,204"
        unit="citations"
        delta="+12%"
        direction="up"
        comparisonLabel="vs previous period"
        ariaLabel="Total citations 1,204, up 12% vs previous period"
        sparkline={[
          { date: '2026-04-01', value: '1' },
          { date: '2026-04-02', value: '4' },
          { date: '2026-04-03', value: '3' },
        ]}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
