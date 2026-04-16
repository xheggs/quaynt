import { afterEach, describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithBrandProviders } from './test-utils';
import { BrandFormDialog } from '../brand-form-dialog';
import type { Brand } from '../../brand.types';

const mockBrand: Brand = {
  id: 'brand-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  domain: 'acme.com',
  aliases: ['Acme', 'ACME'],
  description: 'A test brand',
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function getDialog(baseElement: HTMLElement) {
  return baseElement.querySelector('[role="dialog"]') as HTMLElement;
}

describe('BrandFormDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders create dialog without accessibility violations', async () => {
    const { baseElement } = renderWithBrandProviders(
      <BrandFormDialog mode="create" open={true} onOpenChange={() => {}} />
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

  it('renders edit dialog without accessibility violations', async () => {
    const { baseElement } = renderWithBrandProviders(
      <BrandFormDialog mode="edit" brand={mockBrand} open={true} onOpenChange={() => {}} />
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

  it('renders create dialog with empty fields and correct title', () => {
    const { baseElement } = renderWithBrandProviders(
      <BrandFormDialog mode="create" open={true} onOpenChange={() => {}} />
    );
    const dialog = getDialog(baseElement);
    expect(dialog.textContent).toContain('Add Brand');
    const nameInput = within(dialog).getByPlaceholderText(
      'e.g. Acme Corporation'
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });

  it('renders edit dialog pre-filled with brand data', async () => {
    const { baseElement } = renderWithBrandProviders(
      <BrandFormDialog mode="edit" brand={mockBrand} open={true} onOpenChange={() => {}} />
    );
    const dialog = getDialog(baseElement);
    // react-hook-form defaultValues set DOM values synchronously on mount
    const nameInput = dialog.querySelector('input[id="brand-name"]') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    await waitFor(() => {
      expect(nameInput.value).toBe('Acme Corp');
    });
    const domainInput = dialog.querySelector('input[id="brand-domain"]') as HTMLInputElement;
    expect(domainInput.value).toBe('acme.com');
  });

  it('validates required name field on submit', async () => {
    const { baseElement } = renderWithBrandProviders(
      <BrandFormDialog mode="create" open={true} onOpenChange={() => {}} />
    );
    const dialog = getDialog(baseElement);
    // Find the submit button within the dialog (type="submit")
    const submitButton = dialog.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(dialog.textContent).toContain('Brand name is required');
    });
  });
});
