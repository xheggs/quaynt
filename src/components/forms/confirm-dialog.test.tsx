import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders without accessibility violations when open', async () => {
    const { baseElement } = renderWithProviders(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete brand"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {}}
      />
    );
    expect(
      await axe(baseElement, {
        rules: {
          'color-contrast': { enabled: false },
          'nested-interactive': { enabled: false },
        },
      })
    ).toHaveNoViolations();
  });

  it('renders title and description in dialog', () => {
    const { baseElement } = renderWithProviders(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Remove brand"
        description="This action cannot be undone."
        confirmLabel="Confirm removal"
        onConfirm={() => {}}
      />
    );
    expect(baseElement.textContent).toContain('Remove brand');
    expect(baseElement.textContent).toContain('This action cannot be undone.');
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm"
        description="Sure?"
        confirmLabel="Yes, delete"
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByText('Yes, delete'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('renders cancel button in dialog footer', () => {
    const { baseElement } = renderWithProviders(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm"
        description="Sure?"
        confirmLabel="Yes, delete"
        onConfirm={() => {}}
      />
    );
    const footer = baseElement.querySelector('[data-slot="dialog-footer"]');
    expect(footer).not.toBeNull();
    const cancelBtn = Array.from(footer!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel')
    );
    expect(cancelBtn).toBeDefined();
    expect(cancelBtn!.textContent).toBe('Cancel');
  });

  it('shows loading spinner when isLoading', () => {
    const { baseElement } = renderWithProviders(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm"
        description="Sure?"
        confirmLabel="Delete"
        onConfirm={() => {}}
        isLoading
      />
    );
    // When loading, the spinner SVG (Loader2) should be rendered
    expect(baseElement.querySelector('.animate-spin')).not.toBeNull();
  });
});
