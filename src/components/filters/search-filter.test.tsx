import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { SearchFilter } from './search-filter';

describe('SearchFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without accessibility violations', async () => {
    vi.useRealTimers();
    const { container } = renderWithProviders(<SearchFilter onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('debounces onChange by 300ms', () => {
    const onChange = vi.fn();
    const { container } = renderWithProviders(<SearchFilter onChange={onChange} />);

    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'test' } });

    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('renders clear button when value is present', () => {
    vi.useRealTimers();
    const { container } = renderWithProviders(<SearchFilter value="test" onChange={() => {}} />);
    const clearBtn = container.querySelector('[aria-label="Clear search"]');
    expect(clearBtn).not.toBeNull();
  });
});
