// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSharp = vi.fn();
const mockResize = vi.fn();
const mockPng = vi.fn();
const mockToBuffer = vi.fn();

vi.mock('sharp', () => ({
  default: (...args: unknown[]) => {
    mockSharp(...args);
    return { resize: mockResize };
  },
}));

mockResize.mockReturnValue({ png: mockPng });
mockPng.mockReturnValue({ toBuffer: mockToBuffer });
mockToBuffer.mockResolvedValue(Buffer.from('fake-png'));

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }) },
}));

describe('chart-renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResize.mockReturnValue({ png: mockPng });
    mockPng.mockReturnValue({ toBuffer: mockToBuffer });
    mockToBuffer.mockResolvedValue(Buffer.from('fake-png'));
  });

  it('renderChart produces a buffer for bar chart', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    const result = await renderChart('bar', {
      categories: ['ChatGPT', 'Perplexity'],
      series: [{ name: 'Brand A', values: [42, 28] }],
    });

    expect(result).toBeInstanceOf(Buffer);
    expect(mockSharp).toHaveBeenCalledTimes(1);
    // The first argument to sharp should be a Buffer (SVG string as buffer)
    const svgBuffer = mockSharp.mock.calls[0][0];
    expect(svgBuffer).toBeInstanceOf(Buffer);
    const svgString = svgBuffer.toString();
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('</svg>');
  });

  it('renderChart produces a buffer for line chart', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    const result = await renderChart('line', {
      dates: ['2026-01', '2026-02', '2026-03'],
      series: [{ name: 'Trend', values: [10, 20, 30] }],
    });

    expect(result).toBeInstanceOf(Buffer);
    expect(mockSharp).toHaveBeenCalledTimes(1);
  });

  it('renderChart produces a buffer for pie chart', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    const result = await renderChart('pie', {
      items: [
        { name: 'Brand A', value: 60 },
        { name: 'Brand B', value: 40 },
      ],
    });

    expect(result).toBeInstanceOf(Buffer);
    expect(mockSharp).toHaveBeenCalledTimes(1);
  });

  it('bar chart SVG is valid SVG with chart elements', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    await renderChart('bar', {
      categories: ['A', 'B'],
      series: [
        { name: 'S1', values: [10, 20] },
        { name: 'S2', values: [15, 25] },
      ],
    });

    // Get the most recent call to sharp (this test's call)
    const lastCallIdx = mockSharp.mock.calls.length - 1;
    const svgBuffer = mockSharp.mock.calls[lastCallIdx][0];
    const svgString = svgBuffer.toString();
    // ECharts renders chart elements: SVG root, paths for bars, text for labels
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('</svg>');
    expect(svgString).toContain('<path');
    expect(svgString).toContain('<text');
  });

  it('handles empty data gracefully for bar chart', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    const result = await renderChart('bar', {
      categories: [],
      series: [{ name: 'Empty', values: [] }],
    });

    expect(result).toBeInstanceOf(Buffer);
  });

  it('handles single data point', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    const result = await renderChart('bar', {
      categories: ['Only'],
      series: [{ name: 'Single', values: [100] }],
    });

    expect(result).toBeInstanceOf(Buffer);
  });

  it('handles 25 brands (max)', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    const categories = Array.from({ length: 25 }, (_, i) => `Brand ${i + 1}`);
    const values = Array.from({ length: 25 }, (_, i) => i * 4);

    const result = await renderChart('bar', {
      categories,
      series: [{ name: 'Share', values }],
    });

    expect(result).toBeInstanceOf(Buffer);
  });

  it('passes chart title and axis labels as options', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    await renderChart(
      'bar',
      {
        categories: ['A'],
        series: [{ name: 'S', values: [10] }],
      },
      {
        title: 'Test Title',
        xAxisLabel: 'X',
        yAxisLabel: 'Y',
      }
    );

    const svgString = mockSharp.mock.calls[0][0].toString();
    expect(svgString).toContain('Test Title');
  });

  it('resizes to 2x dimensions for retina', async () => {
    const { renderChart } = await import('./chart-renderer.service');

    await renderChart('bar', {
      categories: ['A'],
      series: [{ name: 'S', values: [10] }],
    });

    expect(mockResize).toHaveBeenCalledWith(1000, 600); // 500*2, 300*2
  });
});
