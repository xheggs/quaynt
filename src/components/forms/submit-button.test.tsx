import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test-utils';
import { SubmitButton } from './submit-button';

describe('SubmitButton', () => {
  it('renders without accessibility violations', async () => {
    const { container } = renderWithProviders(
      <form>
        <SubmitButton>Save</SubmitButton>
      </form>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows loading state when submitting', () => {
    const { container } = renderWithProviders(
      <form>
        <SubmitButton isSubmitting>Save</SubmitButton>
      </form>
    );
    expect(container.textContent).toContain('Saving...');
  });

  it('is disabled when submitting', () => {
    const { container } = renderWithProviders(
      <form>
        <SubmitButton isSubmitting>Save</SubmitButton>
      </form>
    );
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
  });

  it('renders default label from i18n', () => {
    const { container } = renderWithProviders(
      <form>
        <SubmitButton />
      </form>
    );
    expect(container.textContent).toContain('Save');
  });
});
