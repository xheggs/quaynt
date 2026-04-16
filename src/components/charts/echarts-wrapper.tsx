'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { quayntLightTheme, quayntDarkTheme } from './echarts-theme';
import type { EChartsOption } from 'echarts';

export interface ChartDataTable {
  caption: string;
  headers: string[];
  rows: (string | number)[][];
}

// Register tree-shaken ECharts components once
echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);

// Register Quaynt themes
echarts.registerTheme('quaynt-light', quayntLightTheme);
echarts.registerTheme('quaynt-dark', quayntDarkTheme);

interface EChartsWrapperProps {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  ariaLabel: string;
  loading?: boolean;
  dataTable?: ChartDataTable;
}

export function EChartsWrapper({
  option,
  height = 320,
  className,
  ariaLabel,
  loading,
  dataTable,
}: EChartsWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    const themeName = resolvedTheme === 'dark' ? 'quaynt-dark' : 'quaynt-light';
    const chart = echarts.init(containerRef.current, themeName);
    chartRef.current = chart;

    chart.setOption({
      ...option,
      aria: { enabled: true, decal: { show: true } },
    });

    if (loading) {
      chart.showLoading('default', { maskColor: 'transparent' });
    } else {
      chart.hideLoading();
    }

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        chart.resize();
      });
      observer.observe(containerRef.current);
    }

    return () => {
      observer?.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [resolvedTheme, option, loading]);

  return (
    <div className={cn('w-full', className)}>
      <div
        key={resolvedTheme}
        ref={containerRef}
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      />
      {dataTable && (
        <table className="sr-only">
          <caption>{dataTable.caption}</caption>
          <thead>
            <tr>
              {dataTable.headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataTable.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
