import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { MonoChip } from './mono-chip';

describe('MonoChip', () => {
  it('renders children', () => {
    const { getByText } = render(<MonoChip>Live</MonoChip>);
    expect(getByText('Live')).toBeDefined();
  });

  it('applies tone classes', () => {
    const { container } = render(<MonoChip tone="success">OK</MonoChip>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('text-success');
  });

  it('renders the pulse dot only when pulse && tone === "live"', () => {
    const { container, rerender } = render(
      <MonoChip tone="live" pulse>
        LIVE
      </MonoChip>
    );
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();

    rerender(
      <MonoChip tone="default" pulse>
        DEFAULT
      </MonoChip>
    );
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();

    rerender(<MonoChip tone="live">NO PULSE</MonoChip>);
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <MonoChip tone="live" pulse>
        LIVE
      </MonoChip>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
