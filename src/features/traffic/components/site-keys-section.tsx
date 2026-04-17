'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, Check, Copy, Key, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { TableSkeleton } from '@/components/skeletons';

import {
  useSiteKeysQuery,
  useCreateSiteKeyMutation,
  useRevokeSiteKeyMutation,
} from '../use-traffic-queries';
import type { SiteKey, SiteKeyCreated } from '../traffic.types';

export function SiteKeysSection() {
  const t = useTranslations('aiTraffic');
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<SiteKey | null>(null);

  const keysQuery = useSiteKeysQuery();

  if (keysQuery.isError) {
    return (
      <div className="py-12">
        <ErrorState variant="section" onRetry={() => keysQuery.refetch()} />
      </div>
    );
  }

  const keys: SiteKey[] = keysQuery.data?.data ?? [];
  const isLoading = keysQuery.isLoading;
  const isEmpty = !isLoading && keys.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-section">{t('siteKeys.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('siteKeys.description')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('siteKeys.create')}
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-md border border-border">
          <TableSkeleton columns={5} rows={3} />
        </div>
      ) : isEmpty ? (
        <EmptyState
          variant="page"
          icon={Key}
          title={t('empty.title')}
          description={t('empty.description')}
          action={{ label: t('siteKeys.create'), onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">{t('siteKeys.name')}</th>
                <th className="px-4 py-3 font-medium">{t('siteKeys.prefix')}</th>
                <th className="px-4 py-3 font-medium">{t('siteKeys.status')}</th>
                <th className="px-4 py-3 font-medium">{t('siteKeys.lastUsed')}</th>
                <th className="w-16 px-4 py-3" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {key.keyPrefix}...
                  </td>
                  <td className="px-4 py-3">
                    {key.status === 'active' ? (
                      <Badge variant="default">{t('siteKeys.statusActive')}</Badge>
                    ) : (
                      <Badge variant="outline">{t('siteKeys.statusRevoked')}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {key.lastUsedAt ? dateFmt.format(new Date(key.lastUsedAt)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {key.status === 'active' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('siteKeys.revoke')}
                        onClick={() => setRevokeTarget(key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateSiteKeyDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RevokeSiteKeyDialog
        target={revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      />
    </div>
  );
}

function CreateSiteKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('aiTraffic');
  const mutation = useCreateSiteKeyMutation();
  const [name, setName] = useState('');
  const [origins, setOrigins] = useState<string[]>([]);
  const [originDraft, setOriginDraft] = useState('');
  const [created, setCreated] = useState<SiteKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setName('');
      setOrigins([]);
      setOriginDraft('');
      setCreated(null);
      setCopied(false);
    }
    onOpenChange(nextOpen);
  }

  function addOrigin() {
    const trimmed = originDraft.trim();
    if (!trimmed) return;
    if (!origins.includes(trimmed)) setOrigins([...origins, trimmed]);
    setOriginDraft('');
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    const result = await mutation.mutateAsync({
      name: name.trim(),
      allowedOrigins: origins.length > 0 ? origins : undefined,
    });
    setCreated(result);
  }

  function copy() {
    if (created?.plaintextKey) {
      navigator.clipboard.writeText(created.plaintextKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{created ? t('siteKeys.title') : t('siteKeys.create')}</DialogTitle>
          {!created && <DialogDescription>{t('siteKeys.description')}</DialogDescription>}
        </DialogHeader>

        {!created ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('siteKeys.name')}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('siteKeys.allowedOrigins')}</label>
              <p className="text-xs text-muted-foreground">{t('siteKeys.allowedOriginsHelp')}</p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com"
                  value={originDraft}
                  onChange={(e) => setOriginDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addOrigin();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addOrigin}>
                  {t('siteKeys.addOrigin')}
                </Button>
              </div>
              {origins.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-xs">
                  {origins.map((origin) => (
                    <li key={origin}>
                      <Badge variant="outline" className="gap-2">
                        <span>{origin}</span>
                        <button
                          type="button"
                          aria-label="remove"
                          onClick={() => setOrigins(origins.filter((o) => o !== origin))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                {t('siteKeys.cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={!name.trim() || mutation.isPending}>
                {t('siteKeys.create')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('siteKeys.plaintextWarning')}
              </p>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={created.plaintextKey} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={copy}
                aria-label={t('siteKeys.copyKey')}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            {copied && <p className="text-xs text-muted-foreground">{t('siteKeys.copied')}</p>}
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>{t('siteKeys.done')}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RevokeSiteKeyDialog({
  target,
  onOpenChange,
}: {
  target: SiteKey | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('aiTraffic');
  const mutation = useRevokeSiteKeyMutation();

  async function handleRevoke() {
    if (!target) return;
    await mutation.mutateAsync(target.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t('siteKeys.revoke')}</DialogTitle>
          <DialogDescription>{t('siteKeys.revokeConfirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('siteKeys.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleRevoke} disabled={mutation.isPending}>
            {t('siteKeys.revoke')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
