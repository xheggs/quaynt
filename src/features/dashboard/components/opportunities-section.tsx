'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/error-state';
import type { DashboardOpportunity } from '../dashboard.types';

interface OpportunitiesSectionProps {
  opportunities: DashboardOpportunity[] | null;
}

export function OpportunitiesSection({ opportunities }: OpportunitiesSectionProps) {
  const t = useTranslations('dashboard');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="type-section">{t('sections.opportunities')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 px-4 pb-4">
        {opportunities === null ? (
          <ErrorState
            variant="inline"
            description={t('warnings.sectionFailed', { section: t('sections.opportunities') })}
          />
        ) : opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('opportunities.empty')}</p>
        ) : (
          <ul className="divide-y divide-border" data-testid="opportunities-list">
            {opportunities.map((opp) => (
              <li
                key={`${opp.brandId}-${opp.query}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-foreground">{opp.query}</p>
                  <p className="type-caption text-muted-foreground">{opp.brandName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={opp.type === 'missing' ? 'destructive' : 'secondary'}>
                    {t(`opportunities.${opp.type}`)}
                  </Badge>
                  <span className="type-caption text-muted-foreground">
                    {t('opportunities.competitors', { count: opp.competitorCount })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
