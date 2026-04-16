'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  getSupportedLocales,
  getLocaleDisplayName,
  type RegionGroup,
} from '@/lib/locale/supported-locales';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const REGION_GROUP_ORDER: RegionGroup[] = ['americas', 'europe', 'asia-pacific', 'mena'];

const REGION_GROUP_KEYS = {
  americas: 'localeGroupAmericas',
  europe: 'localeGroupEurope',
  'asia-pacific': 'localeGroupAsiaPacific',
  mena: 'localeGroupMena',
} as const satisfies Record<RegionGroup, string>;

interface LocaleSelectorProps {
  value?: string;
  onChange: (locale: string | undefined) => void;
  id?: string;
}

export function LocaleSelector({ value, onChange, id }: LocaleSelectorProps) {
  const t = useTranslations('modelRuns.labels');
  const uiLocale = useLocale();
  const locales = getSupportedLocales();

  const grouped = new Map<RegionGroup, typeof locales>();
  for (const entry of locales) {
    const group = grouped.get(entry.regionGroup) ?? [];
    grouped.set(entry.regionGroup, [...group, entry]);
  }

  const selectorId = id ?? 'locale-selector';

  return (
    <div className="flex flex-col gap-space-2">
      <Label htmlFor={selectorId}>{t('locale')}</Label>
      <Select value={value ?? ''} onValueChange={(val) => onChange(val || undefined)}>
        <SelectTrigger id={selectorId} aria-label={t('locale')}>
          <SelectValue placeholder={t('localePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {REGION_GROUP_ORDER.map((group) => {
            const entries = grouped.get(group);
            if (!entries?.length) return null;
            return (
              <SelectGroup key={group}>
                <SelectLabel>{t(REGION_GROUP_KEYS[group])}</SelectLabel>
                {entries.map((entry) => (
                  <SelectItem key={entry.tag} value={entry.tag}>
                    {getLocaleDisplayName(entry.tag, uiLocale)}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
      <p id={`${selectorId}-help`} className="text-xs text-muted-foreground">
        {t('localeHelp')}
      </p>
    </div>
  );
}
