'use client';

import { Check, Download, Loader2, RefreshCw, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { buildReportDownloadUrl } from '../reports.api';
import { useReportJobQuery } from '../use-reports-query';

interface ReportJobCardProps {
  jobId: string;
  onDismiss: () => void;
}

export function ReportJobCard({ jobId, onDismiss }: ReportJobCardProps) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const { data: job } = useReportJobQuery(jobId);

  if (!job) return null;

  const isActive = job.status === 'pending' || job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isExpired = isCompleted && job.expiresAt && new Date(job.expiresAt) <= new Date();

  const expiresText = job.expiresAt ? formatRelativeTime(new Date(job.expiresAt), locale) : null;

  return (
    <Card
      className={cn(
        'transition-colors',
        isCompleted && !isExpired && 'border-green-500/30',
        isFailed && 'border-destructive/30'
      )}
    >
      <CardContent className="flex items-center gap-4 py-3">
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isActive && <Loader2 className="size-5 animate-spin text-blue-500" />}
          {isCompleted && !isExpired && <Check className="size-5 text-green-600" />}
          {isFailed && <X className="size-5 text-destructive" />}
          {isExpired && <X className="size-5 text-muted-foreground" />}
        </div>

        {/* Status text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isActive && t('job.progress')}
            {isCompleted && !isExpired && t('generate.jobCompleted')}
            {isFailed &&
              (job.error ? `${t('generate.jobFailed')}: ${job.error}` : t('generate.jobFailed'))}
            {isExpired && t('job.expired')}
          </p>
          {isCompleted && !isExpired && expiresText && (
            <p className="text-xs text-muted-foreground">
              {t('job.expiresIn', { timeRemaining: expiresText })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isCompleted && !isExpired && (
            <Button variant="default" size="sm" asChild>
              <a href={buildReportDownloadUrl(jobId)} target="_blank" rel="noopener noreferrer">
                <Download className="size-4" />
                {t('job.download')}
              </a>
            </Button>
          )}
          {isFailed && (
            <Button variant="outline" size="sm" onClick={onDismiss}>
              <RefreshCw className="size-4" />
              {t('job.tryAgain')}
            </Button>
          )}
          {(isFailed || isExpired) && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t('job.dismiss')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(date: Date, locale: string): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return '';
  if (diffDays === 1) return '1 day';

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return rtf.format(diffDays, 'day');
}
