'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { CitationType } from '../citation.types';

interface CitationTypeBadgeProps {
  type: CitationType;
}

export function CitationTypeBadge({ type }: CitationTypeBadgeProps) {
  const t = useTranslations('citations');

  return <Badge variant={type === 'owned' ? 'default' : 'secondary'}>{t(`types.${type}`)}</Badge>;
}
