import { describe, it, expect } from 'vitest';
import { generatePrefixedId, generateId, PREFIXES } from './id';

describe('generatePrefixedId', () => {
  it.each(Object.entries(PREFIXES))('generates %s IDs with prefix %s', (model, prefix) => {
    const id = generatePrefixedId(model as keyof typeof PREFIXES);
    expect(id).toMatch(new RegExp(`^${prefix}_[a-z0-9]{16}$`));
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePrefixedId('user')));
    expect(ids.size).toBe(100);
  });
});

describe('generateId', () => {
  it('generates IDs with a custom prefix', () => {
    const id = generateId('custom');
    expect(id).toMatch(/^custom_[a-z0-9]{16}$/);
  });
});
