import { afterEach, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { cleanup, screen } from '@testing-library/react';

import { renderWithOnboardingProviders } from './test-utils';
import { WowCard } from '../wow-card';
import type { CitationRecord } from '@/features/citations/citation.types';

afterEach(() => cleanup());

const baseCitation: CitationRecord = {
  id: 'cite_1',
  workspaceId: 'ws_1',
  brandId: 'brand_1',
  modelRunId: 'run_1',
  modelRunResultId: 'res_1',
  platformId: 'ChatGPT',
  citationType: 'earned',
  position: 2,
  contextSnippet: 'Quaynt is a tool that tracks AI visibility for brands.',
  relevanceSignal: 'snippet_match',
  sourceUrl: 'https://example.com/article',
  title: 'A great article',
  locale: 'en-US',
  sentimentLabel: 'positive',
  sentimentScore: '0.85',
  sentimentConfidence: '0.9',
  createdAt: '2026-04-26T12:00:00Z',
  updatedAt: '2026-04-26T12:00:00Z',
};

describe('WowCard', () => {
  it('renders the platform name in the headline', () => {
    renderWithOnboardingProviders(
      <WowCard citation={baseCitation} onDismiss={() => {}} viewAllHref="/dashboard" />
    );
    expect(screen.getByRole('heading').textContent).toContain('ChatGPT');
  });

  it('renders an https source link with rel=noopener noreferrer', () => {
    const { container } = renderWithOnboardingProviders(
      <WowCard citation={baseCitation} onDismiss={() => {}} viewAllHref="/dashboard" />
    );
    const sourceLink = container.querySelector('a[href="https://example.com/article"]');
    expect(sourceLink).not.toBeNull();
    expect(sourceLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(sourceLink?.getAttribute('target')).toBe('_blank');
  });

  it('does NOT render an <a href> for javascript: URLs (XSS guard)', () => {
    const malicious: CitationRecord = {
      ...baseCitation,
      sourceUrl: 'javascript:alert(1)',
    };
    const { container } = renderWithOnboardingProviders(
      <WowCard citation={malicious} onDismiss={() => {}} viewAllHref="/dashboard" />
    );
    const links = Array.from(container.querySelectorAll('a'));
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href.toLowerCase().startsWith('javascript:')).toBe(false);
    }
  });

  it('does NOT render an <a href> for data: URLs', () => {
    const malicious: CitationRecord = {
      ...baseCitation,
      sourceUrl: 'data:text/html,<script>alert(1)</script>',
    };
    const { container } = renderWithOnboardingProviders(
      <WowCard citation={malicious} onDismiss={() => {}} viewAllHref="/dashboard" />
    );
    const links = Array.from(container.querySelectorAll('a'));
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href.toLowerCase().startsWith('data:')).toBe(false);
    }
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    renderWithOnboardingProviders(
      <WowCard citation={baseCitation} onDismiss={onDismiss} viewAllHref="/dashboard" />
    );
    screen.getByRole('button', { name: /dismiss/i }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithOnboardingProviders(
      <WowCard citation={baseCitation} onDismiss={() => {}} viewAllHref="/dashboard" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
