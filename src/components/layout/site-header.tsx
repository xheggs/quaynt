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
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

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

export function SiteHeader() {
  const t = useTranslations('ui');
  const locale = useLocale();
  const pathname = usePathname();

  // Parse pathname: /en/dashboard/... → ['dashboard', ...]
  const segments = pathname.replace(`/${locale}`, '').split('/').filter(Boolean);

  const currentSegment = segments[0] ?? 'dashboard';
  const labelKey = routeLabels[currentSegment];
  const currentLabel = labelKey ? t(labelKey as never) : currentSegment;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {segments.length > 1 ? (
              <BreadcrumbLink href={`/${locale}/${currentSegment}`}>{currentLabel}</BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {segments.length > 1 && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="capitalize">
                  {segments.slice(1).join(' / ').replace(/-/g, ' ')}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
