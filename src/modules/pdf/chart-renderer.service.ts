import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import sharp from 'sharp';
import { CHART_DIMENSIONS } from './pdf.types';
import { logger } from '@/lib/logger';

// Register tree-shaken ECharts components once
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  SVGRenderer,
]);

const log = logger.child({ module: 'chart-renderer' });

// --- WCAG-compliant color + pattern palette ---

const BRAND_PALETTE = [
  {
    color: '#4A90D9',
    decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: 0.5 },
  },
  { color: '#E6854A', decal: { symbol: 'circle', dashArrayX: [4, 0], dashArrayY: [4, 0] } },
  {
    color: '#5BB55B',
    decal: { symbol: 'triangle', dashArrayX: [1, 0], dashArrayY: [4, 3], rotation: -0.5 },
  },
  { color: '#9B59B6', decal: { symbol: 'diamond', dashArrayX: [6, 0], dashArrayY: [6, 0] } },
  {
    color: '#E74C3C',
    decal: { symbol: 'rect', dashArrayX: [2, 0], dashArrayY: [4, 3], rotation: 0.8 },
  },
  { color: '#F39C12', decal: { symbol: 'circle', dashArrayX: [6, 0], dashArrayY: [3, 0] } },
  { color: '#1ABC9C', decal: { symbol: 'triangle', dashArrayX: [1, 0], dashArrayY: [6, 3] } },
  { color: '#34495E', decal: { symbol: 'diamond', dashArrayX: [4, 0], dashArrayY: [4, 3] } },
] as const;

function getPaletteItem(index: number) {
  return BRAND_PALETTE[index % BRAND_PALETTE.length];
}

// --- Chart type configurations ---

export interface BarChartData {
  categories: string[];
  series: { name: string; values: number[] }[];
}

export interface LineChartData {
  dates: string[];
  series: { name: string; values: number[] }[];
}

export interface PieChartData {
  items: { name: string; value: number }[];
}

export type ChartType = 'bar' | 'line' | 'pie';

export type ChartData = BarChartData | LineChartData | PieChartData;

export interface ChartOptions {
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

function buildBarOption(data: BarChartData, options: ChartOptions): echarts.EChartsCoreOption {
  return {
    title: options.title
      ? { text: options.title, left: 'center', textStyle: { fontSize: 14 } }
      : undefined,
    xAxis: {
      type: 'category',
      data: data.categories,
      axisLabel: { fontSize: 10, rotate: data.categories.length > 6 ? 30 : 0 },
      name: options.xAxisLabel,
    },
    yAxis: {
      type: 'value',
      name: options.yAxisLabel,
      axisLabel: { fontSize: 10 },
    },
    grid: { top: 50, bottom: 60, left: 60, right: 20 },
    series: data.series.map((s, i) => {
      const palette = getPaletteItem(i);
      return {
        name: s.name,
        type: 'bar' as const,
        data: s.values,
        itemStyle: {
          color: palette.color,
          decal: { ...palette.decal, symbolSize: 1, color: 'rgba(0,0,0,0.2)' },
        },
        label: { show: data.series.length === 1, position: 'top', fontSize: 9 },
      };
    }),
    aria: { enabled: true, decal: { show: true } },
    legend: data.series.length > 1 ? { bottom: 0, textStyle: { fontSize: 10 } } : undefined,
  };
}

function buildLineOption(data: LineChartData, options: ChartOptions): echarts.EChartsCoreOption {
  return {
    title: options.title
      ? { text: options.title, left: 'center', textStyle: { fontSize: 14 } }
      : undefined,
    xAxis: {
      type: 'category',
      data: data.dates,
      axisLabel: { fontSize: 10, rotate: data.dates.length > 10 ? 45 : 0 },
      name: options.xAxisLabel,
    },
    yAxis: {
      type: 'value',
      name: options.yAxisLabel,
      axisLabel: { fontSize: 10 },
    },
    grid: { top: 50, bottom: 60, left: 60, right: 20 },
    series: data.series.map((s, i) => {
      const palette = getPaletteItem(i);
      return {
        name: s.name,
        type: 'line' as const,
        data: s.values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: palette.color, width: 2 },
        itemStyle: { color: palette.color },
      };
    }),
    legend: data.series.length > 1 ? { bottom: 0, textStyle: { fontSize: 10 } } : undefined,
  };
}

function buildPieOption(data: PieChartData, options: ChartOptions): echarts.EChartsCoreOption {
  return {
    title: options.title
      ? { text: options.title, left: 'center', textStyle: { fontSize: 14 } }
      : undefined,
    series: [
      {
        type: 'pie' as const,
        radius: ['30%', '65%'],
        center: ['50%', '55%'],
        data: data.items.map((item, i) => {
          const palette = getPaletteItem(i);
          return {
            name: item.name,
            value: item.value,
            itemStyle: {
              color: palette.color,
              decal: { ...palette.decal, symbolSize: 1, color: 'rgba(0,0,0,0.2)' },
            },
          };
        }),
        label: {
          show: true,
          fontSize: 10,
          formatter: '{b}: {d}%',
        },
      },
    ],
    aria: { enabled: true, decal: { show: true } },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
  };
}

const OPTION_BUILDERS: Record<
  ChartType,
  (data: never, options: ChartOptions) => echarts.EChartsCoreOption
> = {
  bar: buildBarOption as (data: never, options: ChartOptions) => echarts.EChartsCoreOption,
  line: buildLineOption as (data: never, options: ChartOptions) => echarts.EChartsCoreOption,
  pie: buildPieOption as (data: never, options: ChartOptions) => echarts.EChartsCoreOption,
};

/**
 * Render a chart to a PNG buffer suitable for embedding in a PDF.
 *
 * Pipeline: ECharts SSR -> SVG string -> sharp PNG conversion (2x scale).
 */
export async function renderChart(
  type: ChartType,
  data: ChartData,
  options: ChartOptions = {}
): Promise<Buffer> {
  const { width, height, scale } = CHART_DIMENSIONS;

  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width,
    height,
  });

  try {
    const optionBuilder = OPTION_BUILDERS[type];
    chart.setOption(optionBuilder(data as never, options));

    const svgString = chart.renderToSVGString();

    const pngBuffer = await sharp(Buffer.from(svgString))
      .resize(width * scale, height * scale)
      .png()
      .toBuffer();

    return pngBuffer;
  } catch (err) {
    log.error({ type, err }, 'Chart rendering failed');
    throw err;
  } finally {
    chart.dispose();
  }
}
