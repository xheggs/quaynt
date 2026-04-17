'use client';

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';

export function GscHonestyNotice() {
  const t = useTranslations('aiTraffic');

  return (
    <Card
      role="note"
      aria-live="polite"
      className="border-l-2 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30"
    >
      <CardContent className="flex gap-3 p-4">
        <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <p className="text-sm leading-relaxed">{t('gsc.honestyNotice')}</p>
      </CardContent>
    </Card>
  );
}
