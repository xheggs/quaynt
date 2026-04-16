'use client';

import { useState } from 'react';
import { ChevronDown, Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildExportUrl } from '@/features/reports/reports.api';
import type { ExportType } from '@/features/reports/reports.types';

interface ExportButtonProps {
  exportType: ExportType;
  filters: Record<string, string>;
  formats?: ('csv' | 'json' | 'jsonl')[];
  totalCount?: number;
  disabled?: boolean;
}

export function ExportButton({
  exportType,
  filters,
  formats = ['csv', 'json'],
  totalCount,
  disabled,
}: ExportButtonProps) {
  const t = useTranslations('exports');
  const [isPending, setIsPending] = useState(false);

  const triggerDownload = (format: 'csv' | 'json' | 'jsonl') => {
    setIsPending(true);
    const url = buildExportUrl({ type: exportType, format, ...filters });
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setIsPending(false), 1000);
  };

  const label =
    totalCount !== undefined && totalCount > 0
      ? t('buttonWithCount', { count: totalCount })
      : t('button');

  // Single format — direct button
  if (formats.length === 1) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => triggerDownload(formats[0])}
        disabled={disabled || isPending}
        aria-label={label}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {label}
      </Button>
    );
  }

  // Multiple formats — dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" disabled={disabled || isPending} aria-label={label}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {label}
          <ChevronDown className="ml-1 size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((fmt) => (
          <DropdownMenuItem key={fmt} onClick={() => triggerDownload(fmt)}>
            {t(`format.${fmt}` as never)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
