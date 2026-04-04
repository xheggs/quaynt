// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { brandMentionedInText, escapeRegex } from './brand-match';

describe('escapeRegex', () => {
  it('escapes special regex characters', () => {
    expect(escapeRegex('C++')).toBe('C\\+\\+');
    expect(escapeRegex('AT&T')).toBe('AT&T');
    expect(escapeRegex('test.com')).toBe('test\\.com');
    expect(escapeRegex('(hello)')).toBe('\\(hello\\)');
    expect(escapeRegex('a[b]c')).toBe('a\\[b\\]c');
  });

  it('passes through strings without special characters', () => {
    expect(escapeRegex('Acme')).toBe('Acme');
    expect(escapeRegex('hello world')).toBe('hello world');
  });
});

describe('brandMentionedInText', () => {
  it('matches exact brand name (case-insensitive)', () => {
    expect(
      brandMentionedInText('Acme is a great company.', {
        name: 'Acme',
        aliases: [],
      })
    ).toBe(true);
  });

  it('matches brand name case-insensitively', () => {
    expect(
      brandMentionedInText('We recommend ACME for this use case.', {
        name: 'Acme',
        aliases: [],
      })
    ).toBe(true);
  });

  it('matches aliases', () => {
    expect(
      brandMentionedInText('The company formerly known as Widgets Inc is great.', {
        name: 'Acme',
        aliases: ['Widgets Inc'],
      })
    ).toBe(true);
  });

  it('does not match when brand is not mentioned', () => {
    expect(
      brandMentionedInText('This text does not mention any brand.', {
        name: 'Acme',
        aliases: [],
      })
    ).toBe(false);
  });

  it('does not match partial words', () => {
    expect(
      brandMentionedInText('AcmeWidgets is a product.', {
        name: 'Acme',
        aliases: [],
      })
    ).toBe(false);
  });

  it('handles special regex characters in brand names', () => {
    expect(
      brandMentionedInText('We use C++ for systems programming.', {
        name: 'C++',
        aliases: [],
      })
    ).toBe(true);
  });

  it('handles special regex characters in brand names (AT&T)', () => {
    expect(
      brandMentionedInText('AT&T provides telecom services.', {
        name: 'AT&T',
        aliases: [],
      })
    ).toBe(true);
  });

  it('returns false for empty text', () => {
    expect(brandMentionedInText('', { name: 'Acme', aliases: [] })).toBe(false);
  });

  it('returns false when brand is not mentioned and has aliases', () => {
    expect(
      brandMentionedInText('Nothing relevant here.', {
        name: 'Acme',
        aliases: ['Widgets Inc', 'AcmeCorp'],
      })
    ).toBe(false);
  });
});
