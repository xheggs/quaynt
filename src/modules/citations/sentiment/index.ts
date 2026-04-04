import { logger } from '@/lib/logger';
import type { SentimentResult } from './sentiment.types';
import { sentimentAnalyzer } from './afinn-sentiment.analyzer';

export type { SentimentLabel, SentimentResult, SentimentAnalyzer } from './sentiment.types';
export {
  AfinnSentimentAnalyzer,
  sentimentAnalyzer,
  POSITIVE_THRESHOLD,
  NEGATIVE_THRESHOLD,
} from './afinn-sentiment.analyzer';

/**
 * Single integration point for the citation pipeline.
 *
 * For v1 this calls the AFINN analyzer synchronously. If later upgraded to
 * an async approach (e.g. LLM-based), only this function changes — pipeline
 * code does not.
 */
export function analyzeSentiment(contextSnippet: string | null): SentimentResult | null {
  if (!contextSnippet || contextSnippet.trim().length === 0) {
    return { label: 'neutral', score: 0, confidence: 0 };
  }

  try {
    return sentimentAnalyzer.analyze(contextSnippet);
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Sentiment analysis failed, continuing without sentiment'
    );
    return null;
  }
}
