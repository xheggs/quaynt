import { describe, it, expect, afterEach } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';
import { renderWithTrafficProviders } from './test-utils';
import { TrafficRecentFeed } from '../traffic-recent-feed';
import type { RecentVisitEntry } from '../../traffic.types';

const mixedRows: RecentVisitEntry[] = [
  {
    id: '1',
    platform: 'chatgpt',
    source: 'snippet',
    landingPath: '/blog/ai',
    referrerHost: 'chatgpt.com',
    userAgentFamily: 'Chrome',
    visitedAt: '2026-04-16T12:00:00Z',
  },
  {
    id: '2',
    platform: 'perplexity',
    source: 'log',
    landingPath: '/pricing',
    referrerHost: 'www.perplexity.ai',
    userAgentFamily: 'Safari',
    visitedAt: '2026-04-16T11:30:00Z',
  },
  {
    id: '3',
    platform: 'chatgpt',
    source: 'snippet',
    landingPath: '/',
    referrerHost: null,
    userAgentFamily: 'Other',
    visitedAt: '2026-04-16T10:00:00Z',
  },
];

describe('TrafficRecentFeed', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders platform and source badges for each row', () => {
    renderWithTrafficProviders(<TrafficRecentFeed data={mixedRows} loading={false} />);

    // Platform display names
    expect(screen.getAllByText('ChatGPT').length).toBe(2);
    expect(screen.getByText('Perplexity')).toBeDefined();

    // Source badges (snippet appears twice in the mixed fixture)
    expect(screen.getAllByText('Snippet').length).toBe(2);
    expect(screen.getByText('Server logs')).toBeDefined();

    // Landing paths
    expect(screen.getByText('/blog/ai')).toBeDefined();
    expect(screen.getByText('/pricing')).toBeDefined();
  });

  it('has no a11y violations with mixed sources', async () => {
    const { container } = renderWithTrafficProviders(
      <TrafficRecentFeed data={mixedRows} loading={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders an empty state when there are no rows', () => {
    renderWithTrafficProviders(<TrafficRecentFeed data={[]} loading={false} />);
    expect(
      screen.getByText(
        'Add a site key and embed the Quaynt attribution snippet on your site to start tracking visits from AI platforms.'
      )
    ).toBeDefined();
  });
});
