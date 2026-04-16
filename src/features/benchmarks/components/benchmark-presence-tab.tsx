'use client';

import type { PresenceMatrixRow } from '../benchmark.types';
import { PresenceMatrix } from './presence-matrix';

interface BenchmarkPresenceTabProps {
  presenceData: { rows: PresenceMatrixRow[]; total: number } | undefined;
  brandNames: string[];
  page: number;
  onPageChange: (page: number) => void;
}

export function BenchmarkPresenceTab({
  presenceData,
  brandNames,
  page,
  onPageChange,
}: BenchmarkPresenceTabProps) {
  return (
    <PresenceMatrix
      data={presenceData}
      page={page}
      onPageChange={onPageChange}
      brandNames={brandNames}
    />
  );
}
