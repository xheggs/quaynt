import { describe, it, expect } from 'vitest';
import { extractVariables, renderPreview } from '../template-variables';

describe('extractVariables', () => {
  it('extracts variable names from template', () => {
    expect(extractVariables('What is {{brand}} in {{locale}}?')).toEqual(['brand', 'locale']);
  });

  it('deduplicates variable names', () => {
    expect(extractVariables('{{brand}} vs {{brand}} in {{market}}')).toEqual(['brand', 'market']);
  });

  it('returns empty array for no variables', () => {
    expect(extractVariables('No variables here')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractVariables('')).toEqual([]);
  });

  it('handles adjacent variables', () => {
    expect(extractVariables('{{brand}}{{locale}}')).toEqual(['brand', 'locale']);
  });

  it('handles template with only variables', () => {
    expect(extractVariables('{{brand}}')).toEqual(['brand']);
  });

  it('ignores nested braces', () => {
    expect(extractVariables('{{{brand}}}')).toEqual(['brand']);
  });
});

describe('renderPreview', () => {
  it('substitutes provided values', () => {
    expect(
      renderPreview('Hello {{brand}} in {{locale}}', {
        brand: 'Acme',
        locale: 'en-US',
      })
    ).toBe('Hello Acme in en-US');
  });

  it('leaves unmatched variables as-is', () => {
    expect(renderPreview('{{brand}} in {{locale}}', { brand: 'Acme' })).toBe('Acme in {{locale}}');
  });

  it('returns template unchanged when no values provided', () => {
    expect(renderPreview('Hello {{brand}}')).toBe('Hello {{brand}}');
  });

  it('handles empty template', () => {
    expect(renderPreview('', { brand: 'Acme' })).toBe('');
  });
});
