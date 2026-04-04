/**
 * i18n module barrel export.
 *
 * For Client Components: import { Link, useRouter, usePathname } from '@/lib/i18n'
 * For Server Components: import { routing } from '@/lib/i18n/routing' directly
 *   to avoid pulling in client-side navigation code.
 *
 * Do NOT re-export request.ts — it is only used by the next-intl plugin internally.
 */
export { routing, NAMESPACES } from './routing';
export { Link, redirect, usePathname, useRouter, getPathname } from './navigation';
