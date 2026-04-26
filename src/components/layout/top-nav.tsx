'use client';

import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  Combine,
  Compass,
  FileBarChart,
  FileText,
  Gauge,
  Globe,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  Lightbulb,
  Menu,
  Play,
  Quote,
  Settings,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ThemeToggle } from './theme-toggle';
import { useOnboarding, useUpdateOnboarding } from '@/features/onboarding/hooks/use-onboarding';

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
      { labelKey: 'navigation.dualScore', href: '/dual-score', icon: Combine },
      { labelKey: 'navigation.geoScore', href: '/geo-score', icon: Gauge },
      { labelKey: 'navigation.seoScore', href: '/seo-score', icon: LineChart },
      { labelKey: 'navigation.benchmarks', href: '/benchmarks', icon: BarChart3 },
      { labelKey: 'navigation.citations', href: '/citations', icon: Quote },
      { labelKey: 'navigation.opportunities', href: '/opportunities', icon: Lightbulb },
      { labelKey: 'navigation.crawlerAnalytics', href: '/crawler', icon: Bot },
      { labelKey: 'navigation.aiTraffic', href: '/traffic', icon: Globe },
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

// First 5 Monitoring items shown as direct tabs in the desktop nav.
const directTabs = navGroups[0].items.slice(0, 5);
// Remaining Monitoring items collapse into a "More" dropdown to avoid
// horizontal overflow at narrow desktop widths (~1280px).
const moreItems = navGroups[0].items.slice(5);

// Desktop dropdown groups: synthetic "More" overflow group, then the
// existing Configuration and Reporting groups. The titleKey on the
// synthetic group is intentionally distinct from the static sidebar keys
// so it can be detected when rendering trigger labels.
const moreGroup: NavGroup = {
  titleKey: 'topNav.more',
  items: moreItems,
};
const desktopDropdownGroups: NavGroup[] = [moreGroup, ...navGroups.slice(1)];

export function TopNav() {
  const t = useTranslations('ui');
  const tOnboarding = useTranslations('onboarding');
  const locale = useLocale();
  const pathname = usePathname();

  const isActive = (href: string) => pathname.startsWith(`/${locale}${href}`);
  const isGroupActive = (group: NavGroup) => group.items.some((item) => isActive(item.href));

  return (
    <header className="glass-surface sticky top-0 z-50 border-x-0 border-t-0 border-b border-border/60">
      <nav
        aria-label={t('a11y.mainNavigation')}
        className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-4 lg:px-8"
      >
        {/* Logo */}
        <Link href={`/${locale}/dashboard`} className="shrink-0">
          <Logo width={100} height={28} />
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-1 lg:flex">
          {/* Direct tabs for the first 5 Monitoring items */}
          {directTabs.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className={`relative inline-flex h-14 items-center px-3 text-[13px] font-medium transition-colors hover:text-foreground ${
                isActive(item.href)
                  ? 'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-px after:rounded-full after:bg-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {t(item.labelKey as never)}
            </Link>
          ))}

          {/* Dropdown groups: More (overflow), Configuration, Reporting */}
          <NavigationMenu>
            <NavigationMenuList>
              {desktopDropdownGroups.map((group) => (
                <NavigationMenuItem key={group.titleKey}>
                  <NavigationMenuTrigger
                    className={`relative h-14 rounded-none border-b border-transparent px-3 text-[13px] font-medium transition-colors hover:bg-transparent hover:text-foreground focus:bg-transparent data-open:bg-transparent ${
                      isGroupActive(group)
                        ? 'border-primary text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {group.titleKey === 'topNav.more'
                      ? t('topNav.more')
                      : group.titleKey === 'sidebar.configuration'
                        ? t('topNav.configure')
                        : t('topNav.reporting')}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[200px] gap-0.5 p-1.5">
                      {group.items.map((item) => {
                        const tourAnchor = item.href === '/brands' ? 'nav-brands' : undefined;
                        return (
                          <li key={item.href}>
                            <NavigationMenuLink asChild>
                              <Link
                                href={`/${locale}${item.href}`}
                                data-tour={tourAnchor}
                                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                                  isActive(item.href)
                                    ? 'bg-muted/50 font-medium text-foreground'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                <item.icon className="size-4 shrink-0" />
                                {t(item.labelKey as never)}
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        );
                      })}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side: theme toggle + help + settings */}
        <div className="hidden items-center gap-1 lg:flex">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tOnboarding('replay.menuLabel')}
                data-tour="header-help"
              >
                <HelpCircle className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/onboarding/welcome`}>
                  <Play className="size-4" aria-hidden="true" />
                  {tOnboarding('replay.menuLabel')}
                </Link>
              </DropdownMenuItem>
              <DashboardTourMenuItem />
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/settings`} data-tour="nav-settings">
              <Settings className="size-4" />
              <span className="sr-only">{t('navigation.settings')}</span>
            </Link>
          </Button>
        </div>

        {/* Mobile menu */}
        <MobileNav />
      </nav>
    </header>
  );
}

function DashboardTourMenuItem() {
  const tTour = useTranslations('onboarding.tour');
  const onboarding = useOnboarding();
  const update = useUpdateOnboarding();
  const completed = onboarding.data?.milestones.tourCompleted ?? false;

  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        void launchDashboardTour({
          tTour: tTour as unknown as Translator,
          onComplete: () => update.mutate({ milestones: { tourCompleted: true } }),
        });
      }}
    >
      <Compass className="size-4" aria-hidden="true" />
      {completed ? tTour('replayLabel') : tTour('menuLabel')}
    </DropdownMenuItem>
  );
}

type Translator = (key: string, values?: Record<string, unknown>) => string;

async function launchDashboardTour(args: { tTour: Translator; onComplete: () => void }) {
  try {
    const { runDashboardTour, DASHBOARD_TOUR_STEPS } =
      await import('@/features/onboarding/components/dashboard-tour');
    const steps = DASHBOARD_TOUR_STEPS.map((s) => ({
      selector: s.selector,
      title: args.tTour(`steps.${s.slug}.title`),
      body: args.tTour(`steps.${s.slug}.body`),
    }));
    await runDashboardTour({
      steps,
      controls: {
        next: args.tTour('controls.next'),
        prev: args.tTour('controls.prev'),
        done: args.tTour('controls.done'),
        close: args.tTour('controls.close'),
      },
      onComplete: args.onComplete,
    });
  } catch {
    // Driver chunk fetch failure: fail silently so the dashboard remains
    // usable. The menu item stays available for retry.
  }
}

function MobileNav() {
  const t = useTranslations('ui');
  const tOnboarding = useTranslations('onboarding');
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname.startsWith(`/${locale}${href}`);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="size-5" />
            <span className="sr-only">{t('topNav.openMenu')}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-left">
              <Logo width={100} height={28} />
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-6 px-4 py-6">
            {navGroups.map((group) => (
              <div key={group.titleKey}>
                <p className="type-overline mb-2 text-muted-foreground">
                  {t(group.titleKey as never)}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={`/${locale}${item.href}`}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                          isActive(item.href)
                            ? 'bg-muted/50 font-medium text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {t(item.labelKey as never)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Settings + Theme at bottom of mobile nav */}
            <div className="border-t border-border pt-4">
              <Link
                href={`/${locale}/settings`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                  isActive('/settings')
                    ? 'bg-muted/50 font-medium text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                <Settings className="size-4 shrink-0" />
                {t('navigation.settings')}
              </Link>
              <Link
                href={`/${locale}/onboarding/welcome`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                <Play className="size-4 shrink-0" />
                {tOnboarding('replay.menuLabel')}
              </Link>
              <div className="px-3 py-2">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
