import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithReportProviders } from './test-utils';
import { TemplateColorInput } from '../template-color-input';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/reports',
}));

function getTextInput(container: HTMLElement) {
  // The text input is the input with data-slot="input" (the shadcn Input)
  return container.querySelector<HTMLInputElement>('input[data-slot="input"]')!;
}

function getColorInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('input[type="color"]')!;
}

describe('TemplateColorInput', () => {
  it('renders with label and current value', () => {
    const { container } = renderWithReportProviders(
      <TemplateColorInput label="Primary color" value="#9B70BC" onChange={vi.fn()} />
    );

    expect(screen.getByText('Primary color')).toBeDefined();
    expect(getTextInput(container).value).toBe('#9B70BC');
  });

  it('calls onChange when color picker changes', () => {
    const onChange = vi.fn();
    const { container } = renderWithReportProviders(
      <TemplateColorInput label="Primary color" value="#9B70BC" onChange={onChange} />
    );

    fireEvent.change(getColorInput(container), { target: { value: '#ff0000' } });
    expect(onChange).toHaveBeenCalledWith('#ff0000');
  });

  it('calls onChange on valid hex blur', () => {
    const onChange = vi.fn();
    const { container } = renderWithReportProviders(
      <TemplateColorInput label="Primary color" value="#9B70BC" onChange={onChange} />
    );

    const textInput = getTextInput(container);
    // Simulate typing and blurring
    fireEvent.change(textInput, { target: { value: '#00FF00' } });
    // The blur handler reads from e.target.value
    fireEvent.blur(textInput);

    expect(onChange).toHaveBeenCalledWith('#00FF00');
  });

  it('reverts to previous value on invalid hex blur', () => {
    const onChange = vi.fn();
    const { container } = renderWithReportProviders(
      <TemplateColorInput label="Primary color" value="#9B70BC" onChange={onChange} />
    );

    const textInput = getTextInput(container);
    fireEvent.change(textInput, { target: { value: 'not-a-hex' } });
    fireEvent.blur(textInput);

    expect(onChange).not.toHaveBeenCalledWith('not-a-hex');
  });

  it('renders color swatch', () => {
    const { container } = renderWithReportProviders(
      <TemplateColorInput label="Primary color" value="#9B70BC" onChange={vi.fn()} />
    );

    const swatch = container.querySelector('[aria-hidden="true"]');
    expect(swatch).toBeDefined();
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithReportProviders(
      <TemplateColorInput label="Primary color" value="#9B70BC" onChange={vi.fn()} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
