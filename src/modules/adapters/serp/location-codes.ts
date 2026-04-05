// ---------------------------------------------------------------------------
// Shared DataForSEO location code mapping — used by AIO and Copilot adapters.
// ---------------------------------------------------------------------------

/** ISO 3166-1 alpha-2 → DataForSEO location_code for common markets. */
export const COUNTRY_TO_LOCATION_CODE: Record<string, number> = {
  US: 2840,
  GB: 2826,
  DE: 2276,
  FR: 2250,
  ES: 2724,
  IT: 2380,
  NL: 2528,
  BR: 2076,
  AU: 2036,
  CA: 2124,
  IN: 2356,
  JP: 2392,
};

/** Lookup DataForSEO location_code for an ISO 3166-1 alpha-2 country code. */
export function getLocationCode(countryCode: string): number | undefined {
  return COUNTRY_TO_LOCATION_CODE[countryCode.toUpperCase()];
}
