'use client';

import { Braces, FileText, Sheet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { ReportFormat } from '../reports.types';

const formatConfig: Record<
  ReportFormat,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
    icon: React.ElementType;
  }
> = {
  pdf: { variant: 'outline', icon: FileText },
  csv: { variant: 'secondary', icon: Sheet },
  json: { variant: 'secondary', icon: Braces },
  jsonl: { variant: 'secondary', icon: Braces },
};

interface ReportFormatBadgeProps {
  format: ReportFormat;
}

export function ReportFormatBadge({ format }: ReportFormatBadgeProps) {
  const t = useTranslations('reports');

  const config = formatConfig[format];
  if (!config) {
    return <Badge variant="outline">{format}</Badge>;
  }

  const Icon = config.icon;
  const label = t(`schedules.formats.${format}` as never);

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
