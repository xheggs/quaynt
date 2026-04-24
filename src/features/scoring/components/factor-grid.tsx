'use client';

import { cn } from '@/lib/utils';
import { FactorCard, type ScoringFactorView } from './factor-card';

interface FactorGridProps {
  factors: ScoringFactorView[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLUMN_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid gap-4 sm:grid-cols-2',
  3: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4',
};

export function FactorGrid({ factors, columns = 3, className }: FactorGridProps) {
  return (
    <div className={cn(COLUMN_CLASS[columns], className)}>
      {factors.map((f) => (
        <FactorCard key={f.id} factor={f} />
      ))}
    </div>
  );
}
