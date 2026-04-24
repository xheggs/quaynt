'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useDualScoreQuery,
  useDualScoreQueriesQuery,
  useDualScoreRecommendationsQuery,
} from '../use-dual-score';
import type { GapSignal, Granularity } from '../dual-score.types';
import { DualRings } from './dual-rings';
import { CorrelationCard } from './correlation-card';
import { FactorComparisonStrip } from './factor-comparison-strip';
import { GapQueryTable } from './gap-query-table';
import { CombinedRecommendations } from './combined-recommendations';
import { DualAdvisoryBanner } from './dual-advisory-banner';
import { DualScoreSkeleton } from './dual-score-skeleton';

interface DualScoreViewProps {
  brandId?: string;
  defaultGranularity?: Granularity;
}

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

export function DualScoreView({ brandId, defaultGranularity = 'monthly' }: DualScoreViewProps) {
  const t = useTranslations('dualScore');
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);
  const [page, setPage] = useState(1);
  const [gapSignal, setGapSignal] = useState<GapSignal | undefined>(undefined);

  const from = monthsAgoIso(granularity === 'weekly' ? 3 : 12);
  const to = new Date().toISOString().slice(0, 10);

  const scoreQuery = useDualScoreQuery({
    brandId: brandId ?? '',
    granularity,
  });
  const queriesQuery = useDualScoreQueriesQuery({
    brandId: brandId ?? '',
    from,
    to,
    gapSignal,
    page,
    limit: 20,
  });
  const recsQuery = useDualScoreRecommendationsQuery({
    brandId: brandId ?? '',
    granularity,
  });

  if (!brandId) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">
          {t('page.description')}
        </CardContent>
      </Card>
    );
  }

  if (scoreQuery.isLoading) return <DualScoreSkeleton />;

  const dual = scoreQuery.data;
  const codes = dual?.codes ?? [];
  const noData = codes.includes('NO_SNAPSHOTS');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="type-h1 text-2xl font-semibold">{t('page.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('page.description')}</p>
        </div>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">{t('rings.deltaLabel.weekly')}</SelectItem>
            <SelectItem value="monthly">{t('rings.deltaLabel.monthly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dual && <DualAdvisoryBanner advisories={dual.dataQualityAdvisories} />}

      {noData && (
        <Card>
          <CardContent className="space-y-1 py-6 text-center text-sm">
            <p className="font-medium">{t('empty.NO_SNAPSHOTS.title')}</p>
            <p className="text-muted-foreground">{t('empty.NO_SNAPSHOTS.description')}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-8">
          <DualRings dual={dual} granularity={granularity} />
        </CardContent>
      </Card>

      {dual && <CorrelationCard correlation={dual.correlation} granularity={granularity} />}

      <FactorComparisonStrip dual={dual} />

      <GapQueryTable
        rows={queriesQuery.data?.rows}
        isLoading={queriesQuery.isLoading}
        gapSignal={gapSignal}
        onGapSignalChange={(s) => {
          setGapSignal(s);
          setPage(1);
        }}
        page={queriesQuery.data?.page ?? page}
        totalPages={queriesQuery.data?.totalPages ?? 0}
        onPageChange={setPage}
      />

      <CombinedRecommendations data={recsQuery.data} isLoading={recsQuery.isLoading} />
    </div>
  );
}
