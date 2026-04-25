'use client';

import { Lightbulb } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { MonoChip } from '@/components/ui/mono-chip';
import { SectionCard } from '@/components/ui/section-card';
import type { DashboardOpportunity } from '../dashboard.types';

interface OpportunitiesSectionProps {
  opportunities: DashboardOpportunity[] | null;
  className?: string;
}

export function OpportunitiesSection({ opportunities, className }: OpportunitiesSectionProps) {
  const t = useTranslations('dashboard');

  return (
    <SectionCard
      index="02"
      title={t('sections.opportunities')}
      indexLabel={t('sections.indexLabel', { index: '02' })}
      className={className}
    >
      {opportunities === null ? (
        <ErrorState
          variant="inline"
          description={t('warnings.sectionFailed', { section: t('sections.opportunities') })}
        />
      ) : opportunities.length === 0 ? (
        <EmptyState variant="inline" icon={Lightbulb} title={t('opportunities.empty')} />
      ) : (
        <ul className="divide-y divide-border" data-testid="opportunities-list">
          {opportunities.map((opp) => (
            <li
              key={`${opp.brandId}-${opp.query}`}
              className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <MonoChip tone={opp.type === 'missing' ? 'destructive' : 'warning'}>
                  {t(`opportunities.${opp.type}` as 'opportunities.missing')}
                </MonoChip>
                <p className="line-clamp-1 text-sm text-foreground">{opp.query}</p>
                <p className="type-caption text-muted-foreground">{opp.brandName}</p>
              </div>
              <div className="shrink-0">
                <MonoChip tone="muted">
                  {t('opportunities.competitors', { count: opp.competitorCount })}
                </MonoChip>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
