export type { ComparisonPeriod } from './benchmark.types';

export function computeComparisonDates(
  from: string,
  to: string,
  mode: 'previous_period' | 'previous_week' | 'previous_month'
): { compFrom: string; compTo: string } {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  switch (mode) {
    case 'previous_period': {
      const spanMs = toDate.getTime() - fromDate.getTime();
      const compEnd = new Date(fromDate.getTime() - 86_400_000);
      const compStart = new Date(compEnd.getTime() - spanMs);
      return {
        compFrom: compStart.toISOString().slice(0, 10),
        compTo: compEnd.toISOString().slice(0, 10),
      };
    }
    case 'previous_week':
      return {
        compFrom: shiftDays(from, -7),
        compTo: shiftDays(to, -7),
      };
    case 'previous_month': {
      const cf = new Date(from);
      cf.setMonth(cf.getMonth() - 1);
      clampDay(cf, fromDate);
      const ct = new Date(to);
      ct.setMonth(ct.getMonth() - 1);
      clampDay(ct, toDate);
      return {
        compFrom: cf.toISOString().slice(0, 10),
        compTo: ct.toISOString().slice(0, 10),
      };
    }
  }
}

export function shiftDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function clampDay(shifted: Date, original: Date): void {
  if (shifted.getDate() !== original.getDate()) {
    shifted.setDate(0);
  }
}
