import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { render } from '@testing-library/react';
import { Sparkline } from '@/components/ui/sparkline';

const sampleData = [
  { date: '2026-01-01', value: '10' },
  { date: '2026-01-02', value: '20' },
  { date: '2026-01-03', value: '15' },
  { date: '2026-01-04', value: '25' },
];

describe('Sparkline', () => {
  it('renders SVG polyline for multiple data points', () => {
    const { container } = render(<Sparkline data={sampleData} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeDefined();
    expect(polyline?.getAttribute('points')).toBeTruthy();
  });

  it('returns null for empty data', () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders horizontal line for single data point', () => {
    const { container } = render(<Sparkline data={[{ date: '2026-01-01', value: '10' }]} />);
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeDefined();
    const points = polyline?.getAttribute('points') ?? '';
    // Single point should produce a flat line
    const yValues = points.split(' ').map((p) => parseFloat(p.split(',')[1]));
    expect(yValues[0]).toBe(yValues[1]);
  });

  it('renders horizontal line for all-identical values', () => {
    const data = [
      { date: '2026-01-01', value: '5' },
      { date: '2026-01-02', value: '5' },
      { date: '2026-01-03', value: '5' },
    ];
    const { container } = render(<Sparkline data={data} />);
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeDefined();
    const points = polyline?.getAttribute('points') ?? '';
    const yValues = points.split(' ').map((p) => parseFloat(p.split(',')[1]));
    expect(yValues[0]).toBe(yValues[1]);
  });

  it('has aria-hidden attribute', () => {
    const { container } = render(<Sparkline data={sampleData} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('passes accessibility checks', async () => {
    const { container } = render(<Sparkline data={sampleData} />);
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
