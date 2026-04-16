'use client';

import { cn } from '@/lib/utils';

interface SparklinePoint {
  date: string;
  value: string;
}

interface SparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = 'var(--primary)',
  className,
}: SparklineProps) {
  if (data.length === 0) return null;

  const values = data.map((d) => Number(d.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = height * 0.1;
  const usableHeight = height - padding * 2;

  const points = values
    .map((v, i) => {
      const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
      const y = padding + usableHeight - ((v - min) / range) * usableHeight;
      return `${x},${y}`;
    })
    .join(' ');

  // For single point or flat line, render a horizontal line at midpoint
  const isFlatOrSingle = data.length === 1 || max === min;
  const flatPoints = isFlatOrSingle ? `0,${height / 2} ${width},${height / 2}` : undefined;

  const areaPoints = flatPoints ?? `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('shrink-0', className)}
    >
      <polygon points={areaPoints} fill={color} opacity={0.1} />
      <polyline
        points={flatPoints ?? points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
