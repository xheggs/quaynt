import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@testing-library/react';

// Mock ECharts since JSDOM doesn't support Canvas
vi.mock('echarts/core', () => {
  const mockChart = {
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  };
  return {
    use: vi.fn(),
    init: vi.fn(() => mockChart),
    registerTheme: vi.fn(),
  };
});

vi.mock('echarts/charts', () => ({ BarChart: {} }));
vi.mock('echarts/components', () => ({
  GridComponent: {},
  TooltipComponent: {},
  LegendComponent: {},
  AriaComponent: {},
}));
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

import { EChartsWrapper } from '../echarts-wrapper';

describe('EChartsWrapper', () => {
  it('renders chart container with role="img"', () => {
    render(
      <EChartsWrapper
        option={{ xAxis: { type: 'category' }, yAxis: { type: 'value' }, series: [] }}
        ariaLabel="Test chart"
      />
    );
    const chart = screen.getByRole('img');
    expect(chart).toBeDefined();
  });

  it('applies aria-label for accessibility', () => {
    const { container } = render(
      <EChartsWrapper option={{ series: [] }} ariaLabel="Revenue bar chart for Q1 2026" />
    );
    const chart = container.querySelector('[role="img"]');
    expect(chart).toBeDefined();
    expect(chart?.getAttribute('aria-label')).toBe('Revenue bar chart for Q1 2026');
  });

  it('applies custom height', () => {
    const { container } = render(
      <EChartsWrapper option={{ series: [] }} ariaLabel="Test chart" height={500} />
    );
    const chart = container.querySelector('[role="img"]');
    expect(chart).toBeDefined();
    expect(chart?.getAttribute('style')).toContain('500px');
  });

  it('renders visually hidden data table when dataTable prop is provided', () => {
    const { container } = render(
      <EChartsWrapper
        option={{ series: [] }}
        ariaLabel="Test chart"
        dataTable={{
          caption: 'Data for Test chart',
          headers: ['Brand', 'Share'],
          rows: [
            ['Acme', '42%'],
            ['Beta', '28%'],
          ],
        }}
      />
    );
    const table = container.querySelector('table.sr-only');
    expect(table).toBeDefined();
    expect(table?.querySelector('caption')?.textContent).toBe('Data for Test chart');
    const rows = table?.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows?.[0]?.textContent).toContain('Acme');
  });

  it('does not render data table when dataTable is not provided', () => {
    const { container } = render(<EChartsWrapper option={{ series: [] }} ariaLabel="Test chart" />);
    expect(container.querySelector('table')).toBeNull();
  });

  it('passes accessibility checks', async () => {
    const { container } = render(
      <EChartsWrapper option={{ series: [] }} ariaLabel="Accessible chart" />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
