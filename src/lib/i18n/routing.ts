import { defineRouting } from 'next-intl/routing';

/**
 * Supported translation namespace file names.
 * Adding a new namespace requires:
 * 1. Create `locales/{locale}/{namespace}.json`
 * 2. Add the namespace name to this array
 * 3. Add the type import to `types.ts`
 */
export const NAMESPACES = [
  'common',
  'errors',
  'brands',
  'promptSets',
  'adapters',
  'modelRuns',
  'citations',
  'visibility',
  'sentiment',
  'alerts',
  'emails',
  'reports',
  'exports',
  'reports-pdf',
  'reports-templates',
  'dashboard',
  'benchmarks',
  'opportunities',
  'ui',
  'settings',
  'crawlerAnalytics',
  'aiTraffic',
  'integrations',
  'queryFanout',
  'geoScore',
  'seoScore',
  'dualScore',
] as const;

/**
 * Central routing configuration — single source of truth for supported locales.
 * Adding a new language requires only adding the locale code here
 * and creating the corresponding `locales/{locale}/` directory with translation files.
 */
export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
});
