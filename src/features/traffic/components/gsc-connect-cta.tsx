'use client';

import Link from 'next/link';
import { Plug2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';

export function GscConnectCta() {
  const t = useTranslations('aiTraffic');

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="rounded-full bg-muted p-3">
          <Plug2 className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg">{t('gsc.empty.title')}</CardTitle>
          <CardDescription>{t('gsc.empty.description')}</CardDescription>
        </div>
        <Button asChild>
          <Link href="/settings/integrations/gsc">{t('gsc.empty.action')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
