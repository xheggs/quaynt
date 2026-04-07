'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  getSupportedLocales,
  getLocaleDisplayName,
  type RegionGroup,
} from '@/lib/locale/supported-locales';

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

  return (
    <div>
      <label htmlFor={id ?? 'locale-selector'}>{t('locale')}</label>
      <select
        id={id ?? 'locale-selector'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        aria-label={t('locale')}
        aria-describedby={id ? `${id}-help` : 'locale-selector-help'}
      >
        <option value="">{t('localePlaceholder')}</option>
        {REGION_GROUP_ORDER.map((group) => {
          const entries = grouped.get(group);
          if (!entries?.length) return null;
          return (
            <optgroup key={group} label={t(REGION_GROUP_KEYS[group])}>
              {entries.map((entry) => (
                <option key={entry.tag} value={entry.tag}>
                  {getLocaleDisplayName(entry.tag, uiLocale)}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
      <p id={id ? `${id}-help` : 'locale-selector-help'}>{t('localeHelp')}</p>
    </div>
  );
}
