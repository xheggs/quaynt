import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { SectionCard } from './section-card';

describe('SectionCard', () => {
  it('renders index and title', () => {
    const { getByText } = render(
      <SectionCard index="01" title="Top movers" indexLabel="Section 01">
        body
      </SectionCard>
    );
    expect(getByText('01 /')).toBeDefined();
    expect(getByText('Top movers')).toBeDefined();
  });

  it('applies aria-label from indexLabel', () => {
    const { container } = render(
      <SectionCard index="02" title="Opportunities" indexLabel="Section 02">
        body
      </SectionCard>
    );
    const wrapper = container.querySelector('[data-section-card]') as HTMLElement;
    expect(wrapper.getAttribute('aria-label')).toBe('Section 02');
  });

  it('renders action and footer when provided', () => {
    const { getByText } = render(
      <SectionCard
        index="03"
        title="Alerts"
        indexLabel="Section 03"
        action={<button>Refresh</button>}
        footer={<a href="#all">View all</a>}
      >
        body
      </SectionCard>
    );
    expect(getByText('Refresh')).toBeDefined();
    expect(getByText('View all')).toBeDefined();
  });

  it('omits action and footer slots when not provided', () => {
    const { container } = render(
      <SectionCard index="04" title="Quiet" indexLabel="Section 04">
        body
      </SectionCard>
    );
    expect(container.querySelector('[data-slot="card-action"]')).toBeNull();
    expect(container.querySelector('[data-slot="card-footer"]')).toBeNull();
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(
      <SectionCard
        index="01"
        title="Top movers"
        description="Brands with the largest delta this period"
        indexLabel="Section 01"
        footer={<a href="#movers">View all</a>}
      >
        <p>body</p>
      </SectionCard>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
