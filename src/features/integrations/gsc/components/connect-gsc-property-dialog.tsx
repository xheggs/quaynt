'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import {
  usePendingGscOauthQuery,
  useStartGscOauthMutation,
  useConfirmGscConnectionMutation,
} from '../use-gsc-queries';

export function ConnectGscPropertyDialog() {
  const t = useTranslations('integrations');
  const params = useSearchParams();
  const [open, setOpen] = useState(() => params.get('status') === 'pending');
  const [selected, setSelected] = useState<string | null>(null);

  const startMutation = useStartGscOauthMutation();
  const confirmMutation = useConfirmGscConnectionMutation();
  const pending = usePendingGscOauthQuery(open);

  const handleStart = async () => {
    const result = await startMutation.mutateAsync();
    window.location.href = result.authUrl;
  };

  const handleConfirm = async () => {
    if (!selected) return;
    await confirmMutation.mutateAsync(selected);
    setOpen(false);
    setSelected(null);
  };

  const sites = pending.data?.sites ?? [];
  const hasPending = pending.isSuccess && sites.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">{t('gsc.connect')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasPending ? t('gsc.chooseProperty.title') : t('gsc.connect')}</DialogTitle>
          <DialogDescription>
            {hasPending ? t('gsc.chooseProperty.subtitle') : t('gsc.description')}
          </DialogDescription>
        </DialogHeader>

        {hasPending ? (
          <fieldset className="space-y-2 py-2" aria-label={t('gsc.chooseProperty.title')}>
            {sites.map((site) => (
              <div key={site.siteUrl} className="flex items-center gap-3 rounded border p-3">
                <input
                  type="radio"
                  name="gsc-site"
                  id={`gsc-site-${site.siteUrl}`}
                  value={site.siteUrl}
                  checked={selected === site.siteUrl}
                  onChange={() => setSelected(site.siteUrl)}
                  className="size-4"
                />
                <Label
                  htmlFor={`gsc-site-${site.siteUrl}`}
                  className="flex-1 cursor-pointer font-mono text-sm"
                >
                  {site.siteUrl}
                </Label>
              </div>
            ))}
          </fieldset>
        ) : null}

        <DialogFooter>
          {hasPending ? (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!selected || confirmMutation.isPending}
            >
              {t('gsc.connect')}
            </Button>
          ) : (
            <Button type="button" onClick={handleStart} disabled={startMutation.isPending}>
              {t('gsc.connect')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
