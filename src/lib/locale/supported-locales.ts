/**
 * Supported locale configuration for UI display and documentation.
 *
 * This list is **informational** — the API accepts any valid BCP 47 tag with
 * a region subtag. These entries power the locale selector dropdown and
 * per-platform documentation.
 *
 * Display names are derived at runtime via `Intl.DisplayNames` so they
 * automatically adapt to the UI locale without hardcoded translations.
 */

export type RegionGroup = 'americas' | 'europe' | 'asia-pacific' | 'mena';

export interface SupportedLocaleEntry {
  tag: string;
  languageCode: string;
  countryCode: string;
  regionGroup: RegionGroup;
}

const SUPPORTED_LOCALES: readonly SupportedLocaleEntry[] = [
  // Americas
  { tag: 'en-US', languageCode: 'en', countryCode: 'US', regionGroup: 'americas' },
  { tag: 'en-CA', languageCode: 'en', countryCode: 'CA', regionGroup: 'americas' },
  { tag: 'fr-CA', languageCode: 'fr', countryCode: 'CA', regionGroup: 'americas' },
  { tag: 'es-MX', languageCode: 'es', countryCode: 'MX', regionGroup: 'americas' },
  { tag: 'pt-BR', languageCode: 'pt', countryCode: 'BR', regionGroup: 'americas' },
  { tag: 'es-AR', languageCode: 'es', countryCode: 'AR', regionGroup: 'americas' },
  { tag: 'es-CL', languageCode: 'es', countryCode: 'CL', regionGroup: 'americas' },
  { tag: 'es-CO', languageCode: 'es', countryCode: 'CO', regionGroup: 'americas' },
  { tag: 'es-PE', languageCode: 'es', countryCode: 'PE', regionGroup: 'americas' },

  // Europe
  { tag: 'en-GB', languageCode: 'en', countryCode: 'GB', regionGroup: 'europe' },
  { tag: 'en-IE', languageCode: 'en', countryCode: 'IE', regionGroup: 'europe' },
  { tag: 'de-DE', languageCode: 'de', countryCode: 'DE', regionGroup: 'europe' },
  { tag: 'de-AT', languageCode: 'de', countryCode: 'AT', regionGroup: 'europe' },
  { tag: 'de-CH', languageCode: 'de', countryCode: 'CH', regionGroup: 'europe' },
  { tag: 'fr-FR', languageCode: 'fr', countryCode: 'FR', regionGroup: 'europe' },
  { tag: 'fr-BE', languageCode: 'fr', countryCode: 'BE', regionGroup: 'europe' },
  { tag: 'fr-CH', languageCode: 'fr', countryCode: 'CH', regionGroup: 'europe' },
  { tag: 'it-IT', languageCode: 'it', countryCode: 'IT', regionGroup: 'europe' },
  { tag: 'es-ES', languageCode: 'es', countryCode: 'ES', regionGroup: 'europe' },
  { tag: 'pt-PT', languageCode: 'pt', countryCode: 'PT', regionGroup: 'europe' },
  { tag: 'nl-NL', languageCode: 'nl', countryCode: 'NL', regionGroup: 'europe' },
  { tag: 'nl-BE', languageCode: 'nl', countryCode: 'BE', regionGroup: 'europe' },
  { tag: 'pl-PL', languageCode: 'pl', countryCode: 'PL', regionGroup: 'europe' },
  { tag: 'cs-CZ', languageCode: 'cs', countryCode: 'CZ', regionGroup: 'europe' },
  { tag: 'sk-SK', languageCode: 'sk', countryCode: 'SK', regionGroup: 'europe' },
  { tag: 'hu-HU', languageCode: 'hu', countryCode: 'HU', regionGroup: 'europe' },
  { tag: 'ro-RO', languageCode: 'ro', countryCode: 'RO', regionGroup: 'europe' },
  { tag: 'bg-BG', languageCode: 'bg', countryCode: 'BG', regionGroup: 'europe' },
  { tag: 'hr-HR', languageCode: 'hr', countryCode: 'HR', regionGroup: 'europe' },
  { tag: 'sl-SI', languageCode: 'sl', countryCode: 'SI', regionGroup: 'europe' },
  { tag: 'et-EE', languageCode: 'et', countryCode: 'EE', regionGroup: 'europe' },
  { tag: 'lv-LV', languageCode: 'lv', countryCode: 'LV', regionGroup: 'europe' },
  { tag: 'lt-LT', languageCode: 'lt', countryCode: 'LT', regionGroup: 'europe' },
  { tag: 'fi-FI', languageCode: 'fi', countryCode: 'FI', regionGroup: 'europe' },
  { tag: 'sv-SE', languageCode: 'sv', countryCode: 'SE', regionGroup: 'europe' },
  { tag: 'da-DK', languageCode: 'da', countryCode: 'DK', regionGroup: 'europe' },
  { tag: 'nb-NO', languageCode: 'nb', countryCode: 'NO', regionGroup: 'europe' },
  { tag: 'el-GR', languageCode: 'el', countryCode: 'GR', regionGroup: 'europe' },
  { tag: 'uk-UA', languageCode: 'uk', countryCode: 'UA', regionGroup: 'europe' },
  { tag: 'mt-MT', languageCode: 'mt', countryCode: 'MT', regionGroup: 'europe' },
  { tag: 'ga-IE', languageCode: 'ga', countryCode: 'IE', regionGroup: 'europe' },
  { tag: 'lb-LU', languageCode: 'lb', countryCode: 'LU', regionGroup: 'europe' },
  { tag: 'is-IS', languageCode: 'is', countryCode: 'IS', regionGroup: 'europe' },

  // Asia-Pacific
  { tag: 'ja-JP', languageCode: 'ja', countryCode: 'JP', regionGroup: 'asia-pacific' },
  { tag: 'ko-KR', languageCode: 'ko', countryCode: 'KR', regionGroup: 'asia-pacific' },
  { tag: 'zh-CN', languageCode: 'zh', countryCode: 'CN', regionGroup: 'asia-pacific' },
  { tag: 'zh-TW', languageCode: 'zh', countryCode: 'TW', regionGroup: 'asia-pacific' },
  { tag: 'zh-HK', languageCode: 'zh', countryCode: 'HK', regionGroup: 'asia-pacific' },
  { tag: 'en-AU', languageCode: 'en', countryCode: 'AU', regionGroup: 'asia-pacific' },
  { tag: 'en-NZ', languageCode: 'en', countryCode: 'NZ', regionGroup: 'asia-pacific' },
  { tag: 'en-SG', languageCode: 'en', countryCode: 'SG', regionGroup: 'asia-pacific' },
  { tag: 'en-IN', languageCode: 'en', countryCode: 'IN', regionGroup: 'asia-pacific' },
  { tag: 'hi-IN', languageCode: 'hi', countryCode: 'IN', regionGroup: 'asia-pacific' },
  { tag: 'th-TH', languageCode: 'th', countryCode: 'TH', regionGroup: 'asia-pacific' },
  { tag: 'vi-VN', languageCode: 'vi', countryCode: 'VN', regionGroup: 'asia-pacific' },
  { tag: 'id-ID', languageCode: 'id', countryCode: 'ID', regionGroup: 'asia-pacific' },
  { tag: 'ms-MY', languageCode: 'ms', countryCode: 'MY', regionGroup: 'asia-pacific' },
  { tag: 'fil-PH', languageCode: 'fil', countryCode: 'PH', regionGroup: 'asia-pacific' },
  { tag: 'en-PH', languageCode: 'en', countryCode: 'PH', regionGroup: 'asia-pacific' },

  // Middle East & Africa
  { tag: 'ar-SA', languageCode: 'ar', countryCode: 'SA', regionGroup: 'mena' },
  { tag: 'ar-AE', languageCode: 'ar', countryCode: 'AE', regionGroup: 'mena' },
  { tag: 'ar-EG', languageCode: 'ar', countryCode: 'EG', regionGroup: 'mena' },
  { tag: 'he-IL', languageCode: 'he', countryCode: 'IL', regionGroup: 'mena' },
  { tag: 'tr-TR', languageCode: 'tr', countryCode: 'TR', regionGroup: 'mena' },
  { tag: 'en-ZA', languageCode: 'en', countryCode: 'ZA', regionGroup: 'mena' },
  { tag: 'en-NG', languageCode: 'en', countryCode: 'NG', regionGroup: 'mena' },
  { tag: 'en-KE', languageCode: 'en', countryCode: 'KE', regionGroup: 'mena' },
] as const;

/**
 * Get the full list of supported locale entries.
 */
export function getSupportedLocales(): readonly SupportedLocaleEntry[] {
  return SUPPORTED_LOCALES;
}

/**
 * Check whether a tag (after normalisation) matches a known supported locale.
 * This is informational — unknown locales are still accepted by the API.
 */
export function isKnownLocale(tag: string): boolean {
  try {
    const normalized = new Intl.Locale(tag).toString();
    return SUPPORTED_LOCALES.some((entry) => entry.tag === normalized);
  } catch {
    return false;
  }
}

/**
 * Build a human-readable display name for a BCP 47 tag, e.g.
 * `"English (United States)"`. Uses `Intl.DisplayNames` so the output
 * adapts to the caller's UI locale.
 */
export function getLocaleDisplayName(tag: string, uiLocale: string = 'en'): string {
  try {
    const parsed = new Intl.Locale(tag);
    const languageNames = new Intl.DisplayNames([uiLocale], { type: 'language' });
    const regionNames = new Intl.DisplayNames([uiLocale], { type: 'region' });

    const language = languageNames.of(parsed.language) ?? parsed.language;
    const region = parsed.region ? (regionNames.of(parsed.region) ?? parsed.region) : undefined;

    return region ? `${language} (${region})` : language;
  } catch {
    return tag;
  }
}
