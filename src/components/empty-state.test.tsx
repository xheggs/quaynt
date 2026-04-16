import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render } from '@testing-library/react';
import { EmptyState } from './empty-state';
import { Inbox } from 'lucide-react';

describe('EmptyState', () => {
  it('renders page variant without accessibility violations', async () => {
    const { container } = render(
      <EmptyState variant="page" title="No data" description="Nothing to show" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders inline variant without accessibility violations', async () => {
    const { container } = render(<EmptyState variant="inline" title="No results" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders icon when provided', () => {
    const { container } = render(<EmptyState variant="inline" title="Empty" icon={Inbox} />);
    expect(container.querySelector('svg')).toBeDefined();
  });

  it('renders action button with onClick', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <EmptyState variant="inline" title="Empty" action={{ label: 'Create', onClick }} />
    );
    getByText('Create').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders action as link when href is provided', () => {
    const { container } = render(
      <EmptyState variant="inline" title="Empty" action={{ label: 'Go', href: '/new' }} />
    );
    const link = container.querySelector('a');
    expect(link).toBeDefined();
    expect(link?.getAttribute('href')).toBe('/new');
  });
});
