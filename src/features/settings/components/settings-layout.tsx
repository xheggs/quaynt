'use client';

import { Building2, Globe, Key, Puzzle, User, Users, Webhook, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface SettingsNavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

interface SettingsNavGroup {
  titleKey: string;
  items: SettingsNavItem[];
}

const settingsNavGroups: SettingsNavGroup[] = [
  {
    titleKey: 'sidebar.account',
    items: [{ labelKey: 'sidebar.profile', href: '/settings/profile', icon: User }],
  },
  {
    titleKey: 'sidebar.workspace',
    items: [
      { labelKey: 'sidebar.general', href: '/settings/workspace', icon: Building2 },
      { labelKey: 'sidebar.members', href: '/settings/members', icon: Users },
    ],
  },
  {
    titleKey: 'sidebar.integrations',
    items: [
      { labelKey: 'sidebar.adapters', href: '/settings/adapters', icon: Puzzle },
      { labelKey: 'sidebar.apiKeys', href: '/settings/api-keys', icon: Key },
      { labelKey: 'sidebar.siteKeys', href: '/settings/site-keys', icon: Globe },
      { labelKey: 'sidebar.webhooks', href: '/settings/webhooks', icon: Webhook },
    ],
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const t = useTranslations('settings');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex w-full gap-8">
      {/* Desktop sidebar */}
      <nav className="hidden w-[220px] shrink-0 lg:block" aria-label={t('title')}>
        <ul className="space-y-6">
          {settingsNavGroups.map((group) => (
            <li key={group.titleKey}>
              <span className="mb-2 block type-overline text-muted-foreground" role="presentation">
                {t(group.titleKey as never)}
              </span>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const fullHref = `/${locale}${item.href}`;
                  const isActive = pathname === fullHref;
                  return (
                    <li key={item.href}>
                      <Link
                        href={fullHref}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        <item.icon className="size-4" />
                        {t(item.labelKey as never)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile/tablet horizontal tabs */}
      <nav className="mb-6 lg:hidden" aria-label={t('title')}>
        <ul className="flex gap-1 overflow-x-auto border-b border-border pb-px">
          {settingsNavGroups.flatMap((group) =>
            group.items.map((item) => {
              const fullHref = `/${locale}${item.href}`;
              const isActive = pathname === fullHref;
              return (
                <li key={item.href}>
                  <Link
                    href={fullHref}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'border-b-2 border-primary font-medium text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <item.icon className="size-4" />
                    {t(item.labelKey as never)}
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </nav>

      {/* Content area */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
