import Sentiment from 'sentiment';
import type { SentimentAnalyzer, SentimentResult } from './sentiment.types';

export const POSITIVE_THRESHOLD = 0.05;
export const NEGATIVE_THRESHOLD = -0.05;

export class AfinnSentimentAnalyzer implements SentimentAnalyzer {
  private sentiment: Sentiment;

  constructor() {
    this.sentiment = new Sentiment();
  }

  analyze(text: string): SentimentResult {
    if (!text || text.trim().length === 0) {
      return { label: 'neutral', score: 0, confidence: 0 };
    }

    const result = this.sentiment.analyze(text);

    const label =
      result.comparative > POSITIVE_THRESHOLD
        ? 'positive'
        : result.comparative < NEGATIVE_THRESHOLD
          ? 'negative'
          : 'neutral';

    const confidence =
      result.tokens.length === 0
        ? 0
        : Math.min((result.positive.length + result.negative.length) / result.tokens.length, 1.0);

    return {
      label,
      score: result.comparative,
      confidence,
    };
  }
}

export const sentimentAnalyzer = new AfinnSentimentAnalyzer();
