/**
 * Locale validation and utility functions.
 *
 * Uses the built-in `Intl.Locale` API (Node.js, zero dependencies) to parse
 * and validate BCP 47 language tags. All locale values that enter the system
 * via API boundaries should pass through `isValidLocale` before storage.
 */

export interface ParsedLocale {
  tag: string;
  language: string;
  region?: string;
  script?: string;
}

/**
 * Parse a BCP 47 language tag into its components.
 * Returns `null` if the tag is syntactically invalid.
 */
export function parseLocale(tag: string): ParsedLocale | null {
  try {
    const locale = new Intl.Locale(tag);
    return {
      tag: locale.toString(),
      language: locale.language,
      region: locale.region,
      script: locale.script,
    };
  } catch {
    return null;
  }
}

/**
 * Check whether a string is a valid BCP 47 tag **with a region subtag**.
 * Quaynt requires a region because adapter geo-targeting depends on it.
 */
export function isValidLocale(tag: string): boolean {
  const parsed = parseLocale(tag);
  return parsed !== null && parsed.region !== undefined;
}

/**
 * Return the canonical (case-normalised) form of a BCP 47 tag.
 * e.g. `"en-us"` → `"en-US"`, `"ZH-HANS-CN"` → `"zh-Hans-CN"`.
 *
 * Callers should validate with `isValidLocale` first — this function
 * returns the original string unchanged if parsing fails.
 */
export function normalizeLocale(tag: string): string {
  const parsed = parseLocale(tag);
  return parsed ? parsed.tag : tag;
}

/**
 * Extract the country code from a BCP 47 tag for platform geo-targeting.
 * Returns a platform-neutral `{ country }` object that adapters can
 * wrap into their platform-specific format.
 */
export function mapLocaleToUserLocation(locale?: string): { country: string } | undefined {
  if (!locale) return undefined;

  const parsed = parseLocale(locale);
  if (!parsed?.region) return undefined;

  return { country: parsed.region };
}

/**
 * Extract the ISO 639-1 language code from a BCP 47 tag.
 * e.g. `"de-DE"` → `"de"`, `"zh-Hant-TW"` → `"zh"`.
 */
export function getLanguageCode(tag: string): string | undefined {
  const parsed = parseLocale(tag);
  return parsed?.language;
}
