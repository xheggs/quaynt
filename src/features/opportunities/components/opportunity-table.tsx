'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CircleOff, HelpCircle, TrendingDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Opportunity, OpportunitySortField } from '../opportunity.types';
import { getScoreLevel } from './opportunity-summary';
import { OpportunityDetail } from './opportunity-detail';

interface OpportunityTableProps {
  opportunities: Opportunity[];
  sort: OpportunitySortField;
  order: 'asc' | 'desc';
  onSortChange: (field: OpportunitySortField, order: 'asc' | 'desc') => void;
}

const SORT_HEADER_CLASS =
  'cursor-pointer select-none px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground';

const SCORE_ACCENTS = ['border-l-destructive', 'border-l-amber-500', 'border-l-zinc-400'];

function getSortAria(active: boolean, dir: 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  if (!active) return 'none';
  return dir === 'asc' ? 'ascending' : 'descending';
}

const scoreBarStyles = {
  high: 'bg-destructive',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/30',
} as const;

export function OpportunityTable({
  opportunities,
  sort,
  order,
  onSortChange,
}: OpportunityTableProps) {
  const t = useTranslations('opportunities');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Determine top-3 by score for accent borders
  const top3Ids = useMemo(() => {
    const sorted = [...opportunities].sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    return new Set(sorted.slice(0, 3).map((o) => o.id));
  }, [opportunities]);

  const top3Ranked = useMemo(() => {
    const sorted = [...opportunities].sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    const map = new Map<string, number>();
    sorted.slice(0, 3).forEach((o, i) => map.set(o.id, i));
    return map;
  }, [opportunities]);

  function handleSort(field: OpportunitySortField) {
    if (sort === field) {
      onSortChange(field, order === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(field, 'desc');
    }
  }

  function handleToggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm" data-testid="opportunity-table">
          <caption className="sr-only">{t('aria.tableCaption')}</caption>
          <thead>
            <tr className="border-b">
              <th
                scope="col"
                className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
              >
                {t('table.prompt')}
              </th>
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sort === 'type', order)}
                onClick={() => handleSort('type')}
              >
                {t('table.type')}
              </th>
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sort === 'score', order)}
                onClick={() => handleSort('score')}
              >
                <span className="inline-flex items-center gap-1">
                  {t('table.score')}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground">
                        <HelpCircle className="size-3.5" aria-hidden="true" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      {t('score.tooltip')}
                    </TooltipContent>
                  </Tooltip>
                </span>
              </th>
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sort === 'competitorCount', order)}
                onClick={() => handleSort('competitorCount')}
              >
                {t('table.competitors')}
              </th>
              <th
                scope="col"
                className={SORT_HEADER_CLASS}
                aria-sort={getSortAria(sort === 'platformCount', order)}
                onClick={() => handleSort('platformCount')}
              >
                {t('table.platforms')}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
              >
                {t('table.expand')}
              </th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opp) => {
              const isExpanded = expandedId === opp.id;
              const score = parseFloat(opp.score);
              const scoreLevel = getScoreLevel(score);
              const barWidth = (score / 80) * 100;
              const rankIndex = top3Ranked.get(opp.id);
              const isTop3 = top3Ids.has(opp.id);

              // Show up to 3 competitor names, then "+N more"
              const visibleCompetitors = opp.competitors
                .slice()
                .sort((a, b) => b.citationCount - a.citationCount)
                .slice(0, 3);
              const remainingCount = opp.competitors.length - visibleCompetitors.length;

              return (
                <tr key={opp.id} className="group">
                  <td colSpan={6} className="p-0">
                    <div
                      className={cn(
                        'flex items-center border-b border-l-2 hover:bg-muted/50',
                        isTop3 && rankIndex !== undefined
                          ? SCORE_ACCENTS[rankIndex]
                          : 'border-l-transparent'
                      )}
                    >
                      {/* Prompt */}
                      <div className="flex-1 px-4 py-3">
                        <p className="line-clamp-2" title={opp.promptText ?? undefined}>
                          {opp.promptText ?? opp.promptId}
                        </p>
                      </div>

                      {/* Type badge */}
                      <div className="w-28 px-4 py-3">
                        <Badge
                          variant={opp.type === 'missing' ? 'outline' : 'secondary'}
                          className={cn(
                            'inline-flex items-center gap-1',
                            opp.type === 'missing' &&
                              'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          )}
                        >
                          {opp.type === 'missing' ? (
                            <CircleOff className="size-3" aria-hidden="true" />
                          ) : (
                            <TrendingDown className="size-3" aria-hidden="true" />
                          )}
                          {t(`types.${opp.type}`)}
                        </Badge>
                      </div>

                      {/* Score */}
                      <div className="w-32 px-4 py-3 tabular-nums">
                        <div
                          className="flex items-center gap-2"
                          aria-label={t('score.ariaLabel', { score: opp.score })}
                        >
                          <span className="w-10 text-right text-sm">{opp.score}/80</span>
                          <div className="h-2 w-16 rounded-sm bg-muted">
                            <div
                              className={cn('h-full rounded-sm', scoreBarStyles[scoreLevel])}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Competitors */}
                      <div className="w-44 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums">{opp.competitorCount}</span>
                          <div className="flex flex-wrap gap-1">
                            {visibleCompetitors.map((c) => (
                              <span
                                key={c.brandId}
                                className="inline-block max-w-[80px] truncate rounded bg-muted px-1.5 py-0.5 text-xs"
                              >
                                {c.brandName}
                              </span>
                            ))}
                            {remainingCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                +{remainingCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Platforms */}
                      <div className="w-24 px-4 py-3 tabular-nums">{opp.platformCount}</div>

                      {/* Expand toggle */}
                      <div className="w-16 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(opp.id)}
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? t('aria.collapseRow', { prompt: opp.promptText ?? opp.promptId })
                              : t('aria.expandRow', { prompt: opp.promptText ?? opp.promptId })
                          }
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable detail */}
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-200 ease-in-out',
                        isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        {isExpanded && (
                          <div className="border-b bg-muted/20">
                            <OpportunityDetail
                              opportunity={opp}
                              onCollapse={() => setExpandedId(null)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
