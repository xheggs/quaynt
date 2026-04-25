'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('ui');
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="h-8 w-[92px] rounded-md border border-border bg-muted/50"
      />
    );
  }

  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
      className="h-8 gap-0 rounded-md border border-border bg-muted/50 p-0.5"
    >
      <ToggleGroupItem
        value="light"
        aria-label={t('theme.light')}
        className="h-7 w-7 rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        <Sun className="size-3.5" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="dark"
        aria-label={t('theme.dark')}
        className="h-7 w-7 rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        <Moon className="size-3.5" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="system"
        aria-label={t('theme.system')}
        className="h-7 w-7 rounded-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
      >
        <Monitor className="size-3.5" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
