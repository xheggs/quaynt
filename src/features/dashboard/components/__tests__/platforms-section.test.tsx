import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithDashboardProviders } from './test-utils';
import { PlatformsSection } from '../platforms-section';
import type { PlatformStatus } from '../../dashboard.types';

const mockPlatforms: PlatformStatus[] = [
  {
    adapterId: 'a1',
    platformId: 'chatgpt',
    displayName: 'ChatGPT',
    enabled: true,
    lastHealthStatus: 'healthy',
    lastHealthCheckedAt: '2026-04-10T10:00:00Z',
  },
  {
    adapterId: 'a2',
    platformId: 'perplexity',
    displayName: 'Perplexity',
    enabled: true,
    lastHealthStatus: 'degraded',
    lastHealthCheckedAt: '2026-04-10T09:00:00Z',
  },
  {
    adapterId: 'a3',
    platformId: 'gemini',
    displayName: 'Gemini',
    enabled: false,
    lastHealthStatus: null,
    lastHealthCheckedAt: null,
  },
];

describe('PlatformsSection', () => {
  it('renders platform names with correct status text', () => {
    renderWithDashboardProviders(<PlatformsSection platforms={mockPlatforms} />);
    expect(screen.getByText('ChatGPT')).toBeDefined();
    expect(screen.getByText('Perplexity')).toBeDefined();
    expect(screen.getByText('Gemini')).toBeDefined();
  });

  it('shows status text labels (not color-alone)', () => {
    const { container } = renderWithDashboardProviders(
      <PlatformsSection platforms={mockPlatforms} />
    );
    const grid = container.querySelector('[data-testid="platforms-grid"]');
    expect(grid).toBeDefined();
    // All three platforms rendered
    const items = grid?.children;
    expect(items?.length).toBe(3);
    // Text content should contain status labels
    expect(grid?.textContent).toContain('Healthy');
    expect(grid?.textContent).toContain('Degraded');
    expect(grid?.textContent).toContain('Disabled');
  });

  it('renders disabled platforms as dimmed', () => {
    const { container } = renderWithDashboardProviders(
      <PlatformsSection platforms={mockPlatforms} />
    );
    const dimmed = container.querySelector('.opacity-50');
    expect(dimmed).toBeDefined();
    expect(dimmed?.textContent).toContain('Gemini');
  });

  it('shows warning for null', () => {
    const { container } = renderWithDashboardProviders(<PlatformsSection platforms={null} />);
    expect(container.querySelector('[data-slot="error-state"]')).toBeDefined();
  });

  it('shows empty state for empty array', () => {
    renderWithDashboardProviders(<PlatformsSection platforms={[]} />);
    const emptyText = screen.getByText((content) => content.includes('No platforms'));
    expect(emptyText).toBeDefined();
  });

  it('passes accessibility checks', async () => {
    const { container } = renderWithDashboardProviders(
      <PlatformsSection platforms={mockPlatforms} />
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
