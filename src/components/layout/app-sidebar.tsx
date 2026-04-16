'use client';

import {
  BarChart3,
  Bell,
  Building2,
  FileBarChart,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Quote,
  Settings,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Logo } from '@/components/brand/logo';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { ThemeToggle } from './theme-toggle';

interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    titleKey: 'sidebar.monitoring',
    items: [
      { labelKey: 'navigation.dashboard', href: '/dashboard', icon: LayoutDashboard },
      { labelKey: 'navigation.benchmarks', href: '/benchmarks', icon: BarChart3 },
      { labelKey: 'navigation.citations', href: '/citations', icon: Quote },
      { labelKey: 'navigation.opportunities', href: '/opportunities', icon: Lightbulb },
    ],
  },
  {
    titleKey: 'sidebar.configuration',
    items: [
      { labelKey: 'navigation.brands', href: '/brands', icon: Building2 },
      { labelKey: 'navigation.promptSets', href: '/prompt-sets', icon: FileText },
      { labelKey: 'navigation.modelRuns', href: '/model-runs', icon: Zap },
    ],
  },
  {
    titleKey: 'sidebar.reporting',
    items: [
      { labelKey: 'navigation.reports', href: '/reports', icon: FileBarChart },
      { labelKey: 'navigation.alerts', href: '/alerts', icon: Bell },
    ],
  },
];

export function AppSidebar() {
  const t = useTranslations('ui');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={`/${locale}/dashboard`} className="flex items-center">
                <span className="group-data-[collapsible=icon]:hidden">
                  <Logo />
                </span>
                <Image
                  src="/brand/quaynt-icon.png"
                  alt=""
                  aria-hidden
                  width={32}
                  height={32}
                  className="hidden size-8 group-data-[collapsible=icon]:block"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.titleKey}>
            <SidebarGroupLabel>{t(group.titleKey as never)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const fullHref = `/${locale}${item.href}`;
                  const isActive = pathname.startsWith(fullHref);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={t(item.labelKey as never)}
                      >
                        <Link href={fullHref}>
                          <item.icon />
                          <span>{t(item.labelKey as never)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(`/${locale}/settings`)}
              tooltip={t('navigation.settings')}
            >
              <Link href={`/${locale}/settings`}>
                <Settings />
                <span>{t('navigation.settings')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center px-2 py-1 group-data-[collapsible=icon]:justify-center">
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
