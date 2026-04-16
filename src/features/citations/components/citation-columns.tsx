'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ExternalLink, Eye } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableRowActions } from '@/components/data-table/data-table-row-actions';

import type { CitationRecord } from '../citation.types';
import { SentimentBadge } from './sentiment-badge';
import { CitationTypeBadge } from './citation-type-badge';

interface UseCitationColumnsCallbacks {
  onViewDetail: (citation: CitationRecord) => void;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function useCitationColumns({
  onViewDetail,
}: UseCitationColumnsCallbacks): ColumnDef<CitationRecord>[] {
  const t = useTranslations('citations');
  const tUi = useTranslations('ui');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<CitationRecord>[] => [
      {
        id: 'sourceUrl',
        accessorKey: 'sourceUrl',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('table.source')}</span>
        ),
        cell: ({ row }) => {
          const citation = row.original;
          const domain = extractDomain(citation.sourceUrl);
          const displayTitle = citation.title || domain;

          return (
            <div className="min-w-0 max-w-xs">
              <a
                href={citation.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:underline line-clamp-1"
              >
                {displayTitle}
                <ExternalLink className="size-3 shrink-0" />
              </a>
              {citation.title && <p className="type-caption text-muted-foreground">{domain}</p>}
              {citation.contextSnippet && (
                <p className="type-caption text-muted-foreground line-clamp-2 mt-0.5">
                  {citation.contextSnippet}
                </p>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'platformId',
        accessorKey: 'platformId',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('table.platform')}</span>
        ),
        cell: ({ row }) => {
          const pid = row.original.platformId;
          const knownPlatforms = [
            'chatgpt',
            'perplexity',
            'gemini',
            'claude',
            'copilot',
            'grok',
            'deepseek',
            'aio',
          ];
          const label = knownPlatforms.includes(pid)
            ? t(`platforms.${pid}` as Parameters<typeof t>[0])
            : pid;
          return <span className="type-caption text-muted-foreground">{label}</span>;
        },
        enableSorting: false,
      },
      {
        id: 'citationType',
        accessorKey: 'citationType',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('table.type')}</span>
        ),
        cell: ({ row }) => <CitationTypeBadge type={row.original.citationType} />,
        enableSorting: false,
      },
      {
        id: 'position',
        accessorKey: 'position',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('table.position')} />
        ),
        cell: ({ row }) => (
          <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[0.625rem] font-medium tabular-nums">
            #{row.original.position}
          </span>
        ),
        enableSorting: true,
      },
      {
        id: 'sentimentLabel',
        accessorKey: 'sentimentLabel',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">{t('table.sentiment')}</span>
        ),
        cell: ({ row }) => <SentimentBadge sentiment={row.original.sentimentLabel} />,
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title={t('table.date')} />,
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return (
            <span className="type-caption text-muted-foreground">
              {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{tUi('actions.view')}</span>,
        cell: ({ row }) => {
          const citation = row.original;
          return (
            <div className="flex justify-end">
              <DataTableRowActions
                actions={[
                  {
                    label: t('detail.viewDetails'),
                    icon: Eye,
                    onClick: () => onViewDetail(citation),
                  },
                  ...(citation.sourceUrl
                    ? [
                        {
                          label: t('detail.openSource'),
                          icon: ExternalLink,
                          onClick: () =>
                            window.open(citation.sourceUrl, '_blank', 'noopener,noreferrer'),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [t, tUi, locale, onViewDetail]
  );
}
