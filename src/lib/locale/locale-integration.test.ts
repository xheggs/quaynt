// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  parseLocale,
  isValidLocale,
  normalizeLocale,
  mapLocaleToUserLocation,
  getLanguageCode,
} from './locale';
import { getSupportedLocales, isKnownLocale, getLocaleDisplayName } from './supported-locales';

describe('Multi-locale integration', () => {
  const TEST_LOCALES = ['en-US', 'de-DE', 'ja-JP'] as const;

  describe('locale validation across multiple locales', () => {
    it.each(TEST_LOCALES)('validates %s as a valid locale', (tag) => {
      expect(isValidLocale(tag)).toBe(true);
    });

    it.each(TEST_LOCALES)('normalizes %s to canonical form', (tag) => {
      const lower = tag.toLowerCase();
      expect(normalizeLocale(lower)).toBe(tag);
    });

    it.each(TEST_LOCALES)('parses %s into components', (tag) => {
      const parsed = parseLocale(tag);
      expect(parsed).not.toBeNull();
      expect(parsed!.language).toBeTruthy();
      expect(parsed!.region).toBeTruthy();
    });

    it('rejects locales without region', () => {
      expect(isValidLocale('en')).toBe(false);
      expect(isValidLocale('de')).toBe(false);
      expect(isValidLocale('ja')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidLocale('')).toBe(false);
    });
  });

  describe('locale-to-location mapping for adapters', () => {
    it.each(TEST_LOCALES)('maps %s to user location', (tag) => {
      const loc = mapLocaleToUserLocation(tag);
      expect(loc).toBeDefined();
      expect(loc!.country).toHaveLength(2);
    });

    it('maps en-US to country US', () => {
      expect(mapLocaleToUserLocation('en-US')).toEqual({ country: 'US' });
    });

    it('maps de-DE to country DE', () => {
      expect(mapLocaleToUserLocation('de-DE')).toEqual({ country: 'DE' });
    });

    it('maps ja-JP to country JP', () => {
      expect(mapLocaleToUserLocation('ja-JP')).toEqual({ country: 'JP' });
    });

    it('returns undefined for locale without region', () => {
      expect(mapLocaleToUserLocation('en')).toBeUndefined();
    });
  });

  describe('language code extraction for Perplexity search_language_filter', () => {
    it.each([
      ['en-US', 'en'],
      ['de-DE', 'de'],
      ['ja-JP', 'ja'],
      ['zh-Hant-TW', 'zh'],
      ['pt-BR', 'pt'],
    ] as const)('extracts language %s from %s', (tag, expected) => {
      expect(getLanguageCode(tag)).toBe(expected);
    });
  });

  describe('supported locales configuration', () => {
    it('contains at least 60 locales', () => {
      expect(getSupportedLocales().length).toBeGreaterThanOrEqual(60);
    });

    it.each(TEST_LOCALES)('includes %s as a known locale', (tag) => {
      expect(isKnownLocale(tag)).toBe(true);
    });

    it('reports unknown locales correctly', () => {
      expect(isKnownLocale('xx-XX')).toBe(false);
    });

    it('all entries have valid BCP 47 tags', () => {
      for (const entry of getSupportedLocales()) {
        expect(isValidLocale(entry.tag)).toBe(true);
      }
    });

    it('all entries have consistent language/country codes', () => {
      for (const entry of getSupportedLocales()) {
        const parsed = parseLocale(entry.tag);
        expect(parsed!.language).toBe(entry.languageCode);
        expect(parsed!.region).toBe(entry.countryCode);
      }
    });
  });

  describe('display names', () => {
    it('returns readable names for test locales', () => {
      expect(getLocaleDisplayName('en-US', 'en')).toBe('English (United States)');
      expect(getLocaleDisplayName('de-DE', 'en')).toBe('German (Germany)');
      expect(getLocaleDisplayName('ja-JP', 'en')).toBe('Japanese (Japan)');
    });

    it('falls back gracefully for unknown tags', () => {
      const name = getLocaleDisplayName('xx-XX', 'en');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('ChatGPT adapter locale wrapping', () => {
    it('wraps shared location into OpenAI format', () => {
      const loc = mapLocaleToUserLocation('en-US');
      const openAiLocation = loc
        ? { type: 'approximate' as const, country: loc.country }
        : undefined;
      expect(openAiLocation).toEqual({ type: 'approximate', country: 'US' });
    });

    it('returns undefined for missing locale', () => {
      const loc = mapLocaleToUserLocation(undefined);
      const openAiLocation = loc
        ? { type: 'approximate' as const, country: loc.country }
        : undefined;
      expect(openAiLocation).toBeUndefined();
    });
  });

  describe('Perplexity adapter locale + language filter', () => {
    it('derives both user_location and search_language_filter from locale', () => {
      const locale = 'de-DE';
      const userLocation = mapLocaleToUserLocation(locale);
      const lang = getLanguageCode(locale);

      expect(userLocation).toEqual({ country: 'DE' });
      expect(lang).toBe('de');

      // Simulating what the adapter does
      const searchLanguageFilter = lang ? [lang] : undefined;
      expect(searchLanguageFilter).toEqual(['de']);
    });

    it('handles locale with script variant', () => {
      const locale = 'zh-Hant-TW';
      const userLocation = mapLocaleToUserLocation(locale);
      const lang = getLanguageCode(locale);

      expect(userLocation).toEqual({ country: 'TW' });
      expect(lang).toBe('zh');
    });
  });
});
