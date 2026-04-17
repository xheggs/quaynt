// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { extractReferrerHost, classifyLogLineForAiSource } from './crawler-referrer-classifier';
import type { ParsedLogLine } from './crawler.types';

function makeLine(overrides: Partial<ParsedLogLine> = {}): ParsedLogLine {
  return {
    ip: '1.2.3.4',
    timestamp: new Date('2026-04-16T12:00:00Z'),
    method: 'GET',
    path: '/blog',
    statusCode: 200,
    responseBytes: 1024,
    userAgent: 'Mozilla/5.0',
    referer: null,
    ...overrides,
  };
}

describe('crawler-referrer-classifier', () => {
  describe('extractReferrerHost', () => {
    it('returns lowercase hostname for valid URLs', () => {
      expect(extractReferrerHost('https://chatgpt.com/c/abc')).toBe('chatgpt.com');
      expect(extractReferrerHost('https://ChatGPT.COM/')).toBe('chatgpt.com');
    });

    it('strips path, query, and fragment', () => {
      expect(extractReferrerHost('https://perplexity.ai/search?q=foo#x')).toBe('perplexity.ai');
    });

    it('handles URLs with a port', () => {
      expect(extractReferrerHost('https://chatgpt.com:443/c/abc')).toBe('chatgpt.com');
    });

    it('returns null for null, undefined, and empty input', () => {
      expect(extractReferrerHost(null)).toBeNull();
      expect(extractReferrerHost(undefined)).toBeNull();
      expect(extractReferrerHost('')).toBeNull();
    });

    it('returns null for malformed URLs', () => {
      expect(extractReferrerHost('not a url')).toBeNull();
      expect(extractReferrerHost('chatgpt.com')).toBeNull();
    });
  });

  describe('classifyLogLineForAiSource', () => {
    it('matches ChatGPT referrers', () => {
      const result = classifyLogLineForAiSource(makeLine({ referer: 'https://chatgpt.com/c/abc' }));
      expect(result).toEqual({ platform: 'chatgpt', referrerHost: 'chatgpt.com' });
    });

    it('matches Perplexity referrers', () => {
      const result = classifyLogLineForAiSource(
        makeLine({ referer: 'https://www.perplexity.ai/search?q=quaynt' })
      );
      expect(result).toEqual({ platform: 'perplexity', referrerHost: 'www.perplexity.ai' });
    });

    it('matches Gemini referrers', () => {
      const result = classifyLogLineForAiSource(
        makeLine({ referer: 'https://gemini.google.com/app' })
      );
      expect(result).toEqual({ platform: 'gemini', referrerHost: 'gemini.google.com' });
    });

    it('matches Claude referrers', () => {
      const result = classifyLogLineForAiSource(
        makeLine({ referer: 'https://claude.ai/chat/abc' })
      );
      expect(result).toEqual({ platform: 'claude', referrerHost: 'claude.ai' });
    });

    it('is case-insensitive on the hostname', () => {
      const result = classifyLogLineForAiSource(makeLine({ referer: 'https://ChatGPT.COM/c/abc' }));
      expect(result).toEqual({ platform: 'chatgpt', referrerHost: 'chatgpt.com' });
    });

    it('returns null for non-AI referrers', () => {
      expect(
        classifyLogLineForAiSource(makeLine({ referer: 'https://google.com/search?q=foo' }))
      ).toBeNull();
      expect(
        classifyLogLineForAiSource(makeLine({ referer: 'https://news.ycombinator.com/' }))
      ).toBeNull();
    });

    it('returns null for missing referrers', () => {
      expect(classifyLogLineForAiSource(makeLine({ referer: null }))).toBeNull();
    });

    it('returns null for malformed referrers', () => {
      expect(classifyLogLineForAiSource(makeLine({ referer: 'not a url' }))).toBeNull();
      expect(classifyLogLineForAiSource(makeLine({ referer: '-' }))).toBeNull();
    });
  });
});
