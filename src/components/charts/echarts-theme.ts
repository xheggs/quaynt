/**
 * Quaynt ECharts themes consuming design system tokens.
 * See docs/architecture/design-system.md for the categorical palette.
 */

const LIGHT_PALETTE = [
  '#7C5CBA', // Purple (brand-adjacent)
  '#2D8A4E', // Forest
  '#D97706', // Amber
  '#2563EB', // Blue
  '#DC2626', // Crimson
  '#0891B2', // Cyan
  '#9333EA', // Violet
  '#65605A', // Stone
];

const DARK_PALETTE = [
  '#A78BDA', // Purple (brand-adjacent)
  '#5BB97A', // Forest
  '#F59E0B', // Amber
  '#60A5FA', // Blue
  '#F87171', // Crimson
  '#22D3EE', // Cyan
  '#C084FC', // Violet
  '#A8A29E', // Stone
];

const sharedTheme = {
  bar: { barMaxWidth: 40, itemStyle: { borderRadius: 0 } },
  categoryAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    nameTextStyle: { fontFamily: 'Inter, sans-serif', fontSize: 13 },
    axisLabel: { fontFamily: 'Inter, sans-serif', fontSize: 13 },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    nameTextStyle: { fontFamily: 'Inter, sans-serif', fontSize: 13 },
    axisLabel: { fontFamily: 'Inter, sans-serif', fontSize: 13 },
  },
};

export const quayntLightTheme = {
  color: LIGHT_PALETTE,
  ...sharedTheme,
  categoryAxis: {
    ...sharedTheme.categoryAxis,
    axisLabel: { ...sharedTheme.categoryAxis.axisLabel, color: '#65605A' },
    splitLine: { lineStyle: { color: '#E8E8E3' } },
  },
  valueAxis: {
    ...sharedTheme.valueAxis,
    axisLabel: { ...sharedTheme.valueAxis.axisLabel, color: '#65605A' },
    splitLine: { lineStyle: { color: '#E8E8E3' } },
  },
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8E8E3',
    textStyle: { color: '#1C1917', fontFamily: 'Inter, sans-serif', fontSize: 13 },
    extraCssText: 'box-shadow: 0 1px 3px rgba(0,0,0,0.08);',
  },
  legend: {
    textStyle: { color: '#65605A', fontFamily: 'Inter, sans-serif', fontSize: 13 },
  },
};

export const quayntDarkTheme = {
  color: DARK_PALETTE,
  ...sharedTheme,
  categoryAxis: {
    ...sharedTheme.categoryAxis,
    axisLabel: { ...sharedTheme.categoryAxis.axisLabel, color: '#A8A29E' },
    splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
  },
  valueAxis: {
    ...sharedTheme.valueAxis,
    axisLabel: { ...sharedTheme.valueAxis.axisLabel, color: '#A8A29E' },
    splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } },
  },
  tooltip: {
    backgroundColor: '#1C1917',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    textStyle: { color: '#FAFAF9', fontFamily: 'Inter, sans-serif', fontSize: 13 },
  },
  legend: {
    textStyle: { color: '#A8A29E', fontFamily: 'Inter, sans-serif', fontSize: 13 },
  },
};
