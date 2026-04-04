// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  parseLocale,
  isValidLocale,
  normalizeLocale,
  mapLocaleToUserLocation,
  getLanguageCode,
} from './locale';

describe('parseLocale', () => {
  it('parses a simple language-region tag', () => {
    const result = parseLocale('en-US');
    expect(result).toEqual({ tag: 'en-US', language: 'en', region: 'US', script: undefined });
  });

  it('parses a tag with script', () => {
    const result = parseLocale('zh-Hans-CN');
    expect(result).toEqual({ tag: 'zh-Hans-CN', language: 'zh', region: 'CN', script: 'Hans' });
  });

  it('parses a language-only tag (no region)', () => {
    const result = parseLocale('en');
    expect(result).toEqual({ tag: 'en', language: 'en', region: undefined, script: undefined });
  });

  it('returns null for invalid strings', () => {
    expect(parseLocale('')).toBeNull();
    expect(parseLocale('123')).toBeNull();
  });

  it('parses syntactically valid but unknown tags (Intl.Locale is permissive)', () => {
    // Intl.Locale accepts any syntactically valid BCP 47 tag
    const result = parseLocale('xx-XX');
    expect(result).not.toBeNull();
    expect(result?.region).toBe('XX');
  });
});

describe('isValidLocale', () => {
  it('accepts tags with region', () => {
    expect(isValidLocale('en-US')).toBe(true);
    expect(isValidLocale('de-DE')).toBe(true);
    expect(isValidLocale('ja-JP')).toBe(true);
    expect(isValidLocale('pt-BR')).toBe(true);
    expect(isValidLocale('zh-Hans-CN')).toBe(true);
    expect(isValidLocale('zh-Hant-TW')).toBe(true);
  });

  it('rejects tags without region', () => {
    expect(isValidLocale('en')).toBe(false);
    expect(isValidLocale('de')).toBe(false);
  });

  it('rejects invalid strings', () => {
    expect(isValidLocale('')).toBe(false);
  });

  it('accepts syntactically valid tags with region (Intl.Locale is permissive)', () => {
    // xx-XX is syntactically valid BCP 47, so it passes
    expect(isValidLocale('xx-XX')).toBe(true);
  });
});

describe('normalizeLocale', () => {
  it('normalizes case', () => {
    expect(normalizeLocale('en-us')).toBe('en-US');
    expect(normalizeLocale('EN-US')).toBe('en-US');
    expect(normalizeLocale('pt-br')).toBe('pt-BR');
  });

  it('normalizes script case', () => {
    expect(normalizeLocale('zh-hans-cn')).toBe('zh-Hans-CN');
  });

  it('returns original string for invalid input', () => {
    expect(normalizeLocale('invalid')).toBe('invalid');
  });
});

describe('mapLocaleToUserLocation', () => {
  it('returns country from a valid locale', () => {
    expect(mapLocaleToUserLocation('en-US')).toEqual({ country: 'US' });
    expect(mapLocaleToUserLocation('de-DE')).toEqual({ country: 'DE' });
    expect(mapLocaleToUserLocation('ja-JP')).toEqual({ country: 'JP' });
  });

  it('returns undefined for locale without region', () => {
    expect(mapLocaleToUserLocation('en')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(mapLocaleToUserLocation(undefined)).toBeUndefined();
  });

  it('returns undefined for invalid locale', () => {
    expect(mapLocaleToUserLocation('invalid')).toBeUndefined();
  });
});

describe('getLanguageCode', () => {
  it('extracts language from locale tags', () => {
    expect(getLanguageCode('en-US')).toBe('en');
    expect(getLanguageCode('de-DE')).toBe('de');
    expect(getLanguageCode('ja-JP')).toBe('ja');
    expect(getLanguageCode('zh-Hant-TW')).toBe('zh');
  });

  it('returns undefined for truly invalid tags', () => {
    expect(getLanguageCode('')).toBeUndefined();
  });

  it('returns a language even for unknown but syntactically valid tags', () => {
    // Intl.Locale parses "invalid" as language subtag "invalid"
    expect(getLanguageCode('invalid')).toBe('invalid');
  });
});
