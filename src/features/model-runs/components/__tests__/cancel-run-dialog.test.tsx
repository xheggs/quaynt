import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { within } from '@testing-library/react';
import { renderWithRunProviders } from './test-utils';
import { CancelRunDialog } from '../cancel-run-dialog';

function getDialog(baseElement: HTMLElement) {
  return baseElement.querySelector('[role="dialog"]') as HTMLElement;
}

describe('CancelRunDialog', () => {
  it('renders without accessibility violations when open', async () => {
    const { baseElement } = renderWithRunProviders(
      <CancelRunDialog runId="run-1" open={true} onOpenChange={() => {}} />
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

  it('renders cancel description text', () => {
    const { baseElement } = renderWithRunProviders(
      <CancelRunDialog runId="run-1" open={true} onOpenChange={() => {}} />
    );
    const dialog = getDialog(baseElement);
    expect(dialog.textContent).toContain('Pending jobs will be skipped');
  });

  it('renders confirm and cancel buttons', () => {
    const { baseElement } = renderWithRunProviders(
      <CancelRunDialog runId="run-1" open={true} onOpenChange={() => {}} />
    );
    const dialog = getDialog(baseElement);
    expect(within(dialog).getByText('Cancel Run')).toBeDefined();
    expect(within(dialog).getByText('Cancel')).toBeDefined();
  });
});
