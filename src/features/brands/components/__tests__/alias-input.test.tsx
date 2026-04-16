import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithBrandProviders } from './test-utils';
import { AliasInput } from '../alias-input';

function getInput() {
  return screen.getAllByTestId('alias-input')[0] as HTMLInputElement;
}

describe('AliasInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithBrandProviders(
      <AliasInput value={['Acme', 'ACME Corp']} onChange={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders initial aliases as badges', () => {
    const { container } = renderWithBrandProviders(
      <AliasInput value={['Acme', 'ACME Corp']} onChange={() => {}} />
    );
    const list = container.querySelector('ul') as HTMLElement;
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Acme');
    expect(items[1].textContent).toContain('ACME Corp');
  });

  it('adds alias on Enter key', () => {
    const onChange = vi.fn();
    renderWithBrandProviders(<AliasInput value={['Existing']} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: 'New Alias' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Existing', 'New Alias']);
  });

  it('adds alias on comma key', () => {
    const onChange = vi.fn();
    renderWithBrandProviders(<AliasInput value={[]} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(onChange).toHaveBeenCalledWith(['Test']);
  });

  it('removes alias on X button click', () => {
    const onChange = vi.fn();
    renderWithBrandProviders(<AliasInput value={['Alpha', 'Beta']} onChange={onChange} />);
    const removeButton = screen.getByLabelText('Remove Alpha');
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith(['Beta']);
  });

  it('prevents duplicate aliases (case-insensitive)', () => {
    const onChange = vi.fn();
    renderWithBrandProviders(<AliasInput value={['Acme']} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: 'acme' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respects max items limit', () => {
    const aliases = Array.from({ length: 3 }, (_, i) => `Alias${i}`);
    renderWithBrandProviders(<AliasInput value={aliases} onChange={() => {}} maxItems={3} />);
    const input = getInput();
    expect(input.disabled).toBe(true);
  });
});
