import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { expectAccessible } from '@/test-utils';
import { FormField } from '../form-field';

describe('FormField', () => {
  it('renders label and input', () => {
    const { container } = render(
      <FormField name="email" label="Email">
        {(props) => <input {...props} type="email" />}
      </FormField>
    );
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(container.querySelector('#email')).toBeDefined();
  });

  it('does not render error when no error is provided', () => {
    const { container } = render(
      <FormField name="test-no-err" label="Name">
        {(props) => <input {...props} type="text" />}
      </FormField>
    );
    expect(container.querySelector('#test-no-err-error')).toBeNull();
    const input = container.querySelector('#test-no-err')!;
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('links error message via aria-describedby when error is present', () => {
    const { container } = render(
      <FormField name="test-err" label="Name" error="Name is required">
        {(props) => <input {...props} type="text" />}
      </FormField>
    );
    const input = container.querySelector('#test-err')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('test-err-error');

    const errorEl = container.querySelector('#test-err-error');
    expect(errorEl?.textContent).toBe('Name is required');
  });

  it('sets aria-required when required prop is true', () => {
    const { container } = render(
      <FormField name="test-req" label="Name" required>
        {(props) => <input {...props} type="text" />}
      </FormField>
    );
    const input = container.querySelector('#test-req')!;
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('does not set aria-required when required prop is false', () => {
    const { container } = render(
      <FormField name="test-noreq" label="Name">
        {(props) => <input {...props} type="text" />}
      </FormField>
    );
    const input = container.querySelector('#test-noreq')!;
    expect(input.getAttribute('aria-required')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <FormField name="email" label="Email" error="Email is required" required>
        {(props) => <input {...props} type="email" />}
      </FormField>
    );
    await expectAccessible(container);
  });
});
