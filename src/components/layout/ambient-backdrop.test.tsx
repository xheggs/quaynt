import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AmbientBackdrop } from './ambient-backdrop';

describe('AmbientBackdrop', () => {
  it('renders children', () => {
    const { getByText } = render(
      <AmbientBackdrop>
        <p>hello</p>
      </AmbientBackdrop>
    );
    expect(getByText('hello')).toBeDefined();
  });

  it('starts with data-idle="true"', () => {
    const { container } = render(
      <AmbientBackdrop>
        <p>x</p>
      </AmbientBackdrop>
    );
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.dataset.idle).toBe('true');
  });

  it('applies --glow-r from prop', () => {
    const { container } = render(
      <AmbientBackdrop glowRadius="500px">
        <p>x</p>
      </AmbientBackdrop>
    );
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.style.getPropertyValue('--glow-r')).toBe('500px');
  });

  it('uses density-aware default --glow-r when no prop is given', () => {
    const { container, rerender } = render(
      <AmbientBackdrop>
        <p>x</p>
      </AmbientBackdrop>
    );
    let wrap = container.firstElementChild as HTMLElement;
    expect(wrap.style.getPropertyValue('--glow-r')).toBe('220px');

    rerender(
      <AmbientBackdrop density="band">
        <p>x</p>
      </AmbientBackdrop>
    );
    wrap = container.firstElementChild as HTMLElement;
    expect(wrap.style.getPropertyValue('--glow-r')).toBe('320px');
  });

  it('omits the glow div when staticOnly', () => {
    const { container } = render(
      <AmbientBackdrop staticOnly>
        <p>x</p>
      </AmbientBackdrop>
    );
    expect(container.querySelector('.dot-grid-glow')).toBeNull();
  });

  it('renders the glow div by default', () => {
    const { container } = render(
      <AmbientBackdrop>
        <p>x</p>
      </AmbientBackdrop>
    );
    expect(container.querySelector('.dot-grid-glow')).not.toBeNull();
  });

  it('mounts and unmounts cleanly', () => {
    const { unmount } = render(
      <AmbientBackdrop>
        <p>x</p>
      </AmbientBackdrop>
    );
    expect(() => unmount()).not.toThrow();
  });
});
