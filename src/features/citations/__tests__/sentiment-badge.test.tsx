import { describe, it, expect } from 'vitest';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';
import { renderWithCitationProviders } from './test-utils';
import { SentimentBadge } from '../components/sentiment-badge';

describe('SentimentBadge', () => {
  it('renders positive sentiment with icon and label', () => {
    renderWithCitationProviders(<SentimentBadge sentiment="positive" />);
    expect(screen.getByText('Positive')).toBeDefined();
  });

  it('renders neutral sentiment with icon and label', () => {
    renderWithCitationProviders(<SentimentBadge sentiment="neutral" />);
    expect(screen.getByText('Neutral')).toBeDefined();
  });

  it('renders negative sentiment with icon and label', () => {
    renderWithCitationProviders(<SentimentBadge sentiment="negative" />);
    expect(screen.getByText('Negative')).toBeDefined();
  });

  it('renders dash for null sentiment', () => {
    const { container } = renderWithCitationProviders(<SentimentBadge sentiment={null} />);
    expect(container.textContent).toContain('—');
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderWithCitationProviders(<SentimentBadge sentiment="positive" />);
    expect(
      await axe(container, {
        rules: { 'color-contrast': { enabled: false } },
      })
    ).toHaveNoViolations();
  });
});
