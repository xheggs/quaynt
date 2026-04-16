import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('renders page variant without accessibility violations', async () => {
    const { container } = renderWithProviders(<ErrorState variant="page" onRetry={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders section variant without accessibility violations', async () => {
    const { container } = renderWithProviders(<ErrorState variant="section" onRetry={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders inline variant without accessibility violations', async () => {
    const { container } = renderWithProviders(<ErrorState variant="inline" onRetry={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    const { container } = renderWithProviders(<ErrorState variant="section" onRetry={onRetry} />);
    const btn = container.querySelector('[data-slot="button"]') as HTMLElement;
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not render retry button when onRetry is not provided', () => {
    const { container } = renderWithProviders(<ErrorState variant="section" />);
    const btn = container.querySelector('[data-slot="button"]');
    expect(btn).toBeNull();
  });

  it('renders custom title and description', () => {
    const { getByText } = renderWithProviders(
      <ErrorState variant="section" title="Custom error" description="Custom description" />
    );
    expect(getByText('Custom error')).toBeDefined();
    expect(getByText('Custom description')).toBeDefined();
  });
});
