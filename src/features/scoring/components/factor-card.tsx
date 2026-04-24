'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ScoringFactorStatus = 'active' | 'notYetScored' | 'insufficientData';

export interface ScoringFactorView {
  id: string;
  score: number | null;
  weight: number;
  status: ScoringFactorStatus;
  name: string;
  description: string;
  weightLabel: string;
  statusLabel: string;
  hint?: string | null;
}

interface FactorCardProps {
  factor: ScoringFactorView;
  className?: string;
}

function scoreColor(score: number): string {
  if (score < 40) return 'bg-destructive';
  if (score < 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function FactorCard({ factor, className }: FactorCardProps) {
  const hasScore = factor.score !== null;
  const color = hasScore ? scoreColor(factor.score!) : 'bg-muted';

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{factor.name}</h3>
          <Badge variant="outline" className="shrink-0 text-xs">
            {factor.weightLabel}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs leading-snug">{factor.description}</p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="type-kpi text-foreground text-2xl tabular-nums">
            {hasScore ? Math.round(factor.score!) : '—'}
          </span>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs',
              factor.status === 'active' &&
                'border-emerald-500 text-emerald-700 dark:text-emerald-400',
              factor.status === 'notYetScored' &&
                'border-amber-500 text-amber-700 dark:text-amber-400',
              factor.status === 'insufficientData' &&
                'border-muted-foreground text-muted-foreground'
            )}
          >
            {factor.statusLabel}
          </span>
        </div>
        <div
          className="bg-muted h-2 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={hasScore ? Math.round(factor.score!) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn('h-full transition-[width] duration-500', color)}
            style={{ width: `${hasScore ? factor.score! : 0}%` }}
          />
        </div>
        {factor.hint && <p className="text-muted-foreground text-xs">{factor.hint}</p>}
      </CardContent>
    </Card>
  );
}
