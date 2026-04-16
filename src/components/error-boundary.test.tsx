import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { expectAccessible } from '@/test-utils';
import { ErrorBoundary } from './error-boundary';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Content</div>;
}

describe('ErrorBoundary', () => {
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(getByText('Content')).toBeDefined();
  });

  it('has no accessibility violations when rendering children', async () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    await expectAccessible(container);
  });

  it('renders fallback when error is thrown', () => {
    const { getByText } = render(
      <ErrorBoundary fallback={<div>Error fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByText('Error fallback')).toBeDefined();
  });

  it('renders fallback function with error and reset', () => {
    const { getByText } = render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <div>
            <span>{error.message}</span>
            <button onClick={reset}>Reset</button>
          </div>
        )}
      >
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByText('Test error')).toBeDefined();
  });
});
