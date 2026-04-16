'use client';

import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const routeLabels: Record<string, string> = {
  dashboard: 'navigation.dashboard',
  benchmarks: 'navigation.benchmarks',
  brands: 'navigation.brands',
  'prompt-sets': 'navigation.promptSets',
  'model-runs': 'navigation.modelRuns',
  citations: 'navigation.citations',
  opportunities: 'navigation.opportunities',
  alerts: 'navigation.alerts',
  reports: 'navigation.reports',
  settings: 'navigation.settings',
};

/**
 * Page-level breadcrumb for detail and form pages.
 * Only renders when the route has more than one segment (e.g., /brands/123).
 */
export function PageBreadcrumb() {
  const t = useTranslations('ui');
  const locale = useLocale();
  const pathname = usePathname();

  const segments = pathname.replace(`/${locale}`, '').split('/').filter(Boolean);

  // Only show breadcrumb on nested routes
  if (segments.length <= 1) return null;

  const currentSegment = segments[0] ?? 'dashboard';
  const labelKey = routeLabels[currentSegment];
  const currentLabel = labelKey ? t(labelKey as never) : currentSegment;

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/${locale}/${currentSegment}`}>{currentLabel}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="capitalize">
            {segments.slice(1).join(' / ').replace(/-/g, ' ')}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** @deprecated Use PageBreadcrumb instead */
export const SiteHeader = PageBreadcrumb;
