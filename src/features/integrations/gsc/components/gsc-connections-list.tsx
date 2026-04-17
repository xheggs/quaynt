'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useGscConnectionsQuery, useDeleteGscConnectionMutation } from '../use-gsc-queries';
import type { GscConnection } from '../gsc.api';

interface Props {
  compact?: boolean;
}

function statusKey(status: GscConnection['status']): string {
  switch (status) {
    case 'active':
      return 'integrations.gsc.status.active';
    case 'reauth_required':
      return 'integrations.gsc.status.reauthRequired';
    case 'forbidden':
      return 'integrations.gsc.status.forbidden';
    case 'revoked':
    default:
      return 'integrations.gsc.status.revoked';
  }
}

export function GscConnectionsList({ compact = false }: Props) {
  const t = useTranslations('integrations');
  const format = useFormatter();
  const query = useGscConnectionsQuery();
  const deleteMutation = useDeleteGscConnectionMutation();

  if (query.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const connections = query.data?.connections ?? [];

  if (connections.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t('gsc.description')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {connections.map((c) => {
        const tStatus = t as unknown as (key: string) => string;
        return (
          <Card key={c.id}>
            <CardContent
              className={
                compact
                  ? 'flex items-center justify-between gap-3 p-3 text-sm'
                  : 'flex flex-wrap items-center justify-between gap-4 p-4'
              }
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.propertyUrl}</div>
                {!compact && c.lastSyncAt && (
                  <div className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(c.lastSyncAt), 'short')}
                  </div>
                )}
              </div>
              <Badge variant="outline">{tStatus(statusKey(c.status))}</Badge>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(c.id)}
                aria-label={t('gsc.disconnect')}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {!compact && <span className="ml-1.5">{t('gsc.disconnect')}</span>}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
