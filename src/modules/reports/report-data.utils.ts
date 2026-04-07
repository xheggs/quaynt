import type { SparklinePoint } from './report-data.types';

export function resolveSparklineGranularity(from: string, to: string): 'day' | 'week' | 'month' {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffMs = toDate.getTime() - fromDate.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays <= 90) return 'day';
  if (diffDays <= 365) return 'week';
  return 'month';
}

export function capSparklinePoints(points: SparklinePoint[], maxPoints = 30): SparklinePoint[] {
  if (points.length <= maxPoints) return points;

  const result: SparklinePoint[] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    result.push(points[idx]);
  }

  result.push(points[points.length - 1]);
  return result;
}
