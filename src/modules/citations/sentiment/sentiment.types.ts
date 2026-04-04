export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface SentimentResult {
  label: SentimentLabel;
  score: number;
  confidence: number;
}

export interface SentimentAnalyzer {
  analyze(text: string): SentimentResult;
}
