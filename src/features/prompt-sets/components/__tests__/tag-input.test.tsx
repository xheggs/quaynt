import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderWithPromptSetProviders } from './test-utils';
import { TagInput } from '../tag-input';

function getInput() {
  return screen.getAllByTestId('tag-input')[0] as HTMLInputElement;
}

describe('TagInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithPromptSetProviders(
      <TagInput value={['seo', 'competitor']} onChange={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders initial tags as badges', () => {
    const { container } = renderWithPromptSetProviders(
      <TagInput value={['seo', 'competitor']} onChange={() => {}} />
    );
    const list = container.querySelector('ul') as HTMLElement;
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('seo');
    expect(items[1].textContent).toContain('competitor');
  });

  it('adds tag on Enter key', () => {
    const onChange = vi.fn();
    renderWithPromptSetProviders(<TagInput value={['existing']} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: 'new-tag' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['existing', 'new-tag']);
  });

  it('adds tag on comma key', () => {
    const onChange = vi.fn();
    renderWithPromptSetProviders(<TagInput value={[]} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(onChange).toHaveBeenCalledWith(['test']);
  });

  it('lowercases added tags', () => {
    const onChange = vi.fn();
    renderWithPromptSetProviders(<TagInput value={[]} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: 'SEO' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['seo']);
  });

  it('removes tag on X button click', () => {
    const onChange = vi.fn();
    renderWithPromptSetProviders(<TagInput value={['alpha', 'beta']} onChange={onChange} />);
    const removeButton = screen.getByLabelText('Remove alpha');
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith(['beta']);
  });

  it('prevents duplicate tags', () => {
    const onChange = vi.fn();
    renderWithPromptSetProviders(<TagInput value={['seo']} onChange={onChange} />);
    const input = getInput();
    fireEvent.change(input, { target: { value: 'seo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('respects max items limit', () => {
    const tags = Array.from({ length: 3 }, (_, i) => `tag${i}`);
    renderWithPromptSetProviders(<TagInput value={tags} onChange={() => {}} maxItems={3} />);
    const input = getInput();
    expect(input.disabled).toBe(true);
  });
});
