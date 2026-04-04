import { describe, it, expect } from 'vitest';
import { AfinnSentimentAnalyzer } from './afinn-sentiment.analyzer';

describe('AfinnSentimentAnalyzer', () => {
  const analyzer = new AfinnSentimentAnalyzer();

  it('classifies clearly positive text as positive', () => {
    const result = analyzer.analyze('This product is excellent, wonderful, and amazing');
    expect(result.label).toBe('positive');
    expect(result.score).toBeGreaterThan(0.05);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('classifies clearly negative text as negative', () => {
    const result = analyzer.analyze('This is terrible, awful, and horrible service');
    expect(result.label).toBe('negative');
    expect(result.score).toBeLessThan(-0.05);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('classifies neutral/factual text as neutral', () => {
    const result = analyzer.analyze('The company was founded in 2020 and is based in London');
    expect(result.label).toBe('neutral');
  });

  it('returns neutral with zero score and confidence for empty string', () => {
    const result = analyzer.analyze('');
    expect(result).toEqual({ label: 'neutral', score: 0, confidence: 0 });
  });

  it('returns neutral with zero confidence for null/undefined text', () => {
    const result = analyzer.analyze(null as unknown as string);
    expect(result).toEqual({ label: 'neutral', score: 0, confidence: 0 });
  });

  it('classifies mixed sentiment based on net score', () => {
    const result = analyzer.analyze('The product has great features but terrible customer support');
    expect(result.label).toBeDefined();
    expect(['positive', 'neutral', 'negative']).toContain(result.label);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('reflects ratio of scored words in confidence', () => {
    const highMatch = analyzer.analyze('great excellent wonderful amazing');
    const lowMatch = analyzer.analyze(
      'the system processes data through the integration layer using great algorithms'
    );
    expect(highMatch.confidence).toBeGreaterThan(lowMatch.confidence);
  });

  it('returns neutral with zero confidence when no AFINN words match', () => {
    const result = analyzer.analyze('the system integrates with the platform via the API endpoint');
    expect(result.label).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  describe('real-world AI citation snippets', () => {
    it('classifies positive AI recommendation', () => {
      const result = analyzer.analyze(
        'Brand X is a trusted leader in the industry and widely recommended for its excellent performance'
      );
      expect(result.label).toBe('positive');
    });

    it('classifies negative AI criticism', () => {
      const result = analyzer.analyze(
        'Brand X has been plagued by terrible performance issues and awful user complaints'
      );
      expect(result.label).toBe('negative');
    });

    it('classifies neutral AI description', () => {
      const result = analyzer.analyze(
        'Brand X offers project management software for teams and organizations'
      );
      expect(result.label).toBe('neutral');
    });
  });
});
