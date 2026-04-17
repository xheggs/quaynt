// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  identifyAiSource,
  getAiSourceDictionary,
  getPlatformDisplayName,
} from './ai-source-dictionary';

describe('ai-source-dictionary', () => {
  describe('identifyAiSource — referrer matches', () => {
    it('identifies ChatGPT from chatgpt.com', () => {
      const result = identifyAiSource('https://chatgpt.com/', null);
      expect(result).toEqual({ platform: 'chatgpt', displayName: 'ChatGPT', via: 'referrer' });
    });

    it('identifies ChatGPT from chat.openai.com', () => {
      const result = identifyAiSource('https://chat.openai.com/chat', null);
      expect(result?.platform).toBe('chatgpt');
    });

    it('identifies Perplexity from perplexity.ai', () => {
      const result = identifyAiSource('https://perplexity.ai/search?q=foo', null);
      expect(result?.platform).toBe('perplexity');
    });

    it('identifies Perplexity from www.perplexity.ai', () => {
      const result = identifyAiSource('https://www.perplexity.ai/', null);
      expect(result?.platform).toBe('perplexity');
    });

    it('identifies Gemini from gemini.google.com', () => {
      const result = identifyAiSource('https://gemini.google.com/app', null);
      expect(result?.platform).toBe('gemini');
    });

    it('identifies Claude from claude.ai', () => {
      const result = identifyAiSource('https://claude.ai/chats/abc', null);
      expect(result?.platform).toBe('claude');
    });

    it('identifies Copilot from copilot.microsoft.com', () => {
      const result = identifyAiSource('https://copilot.microsoft.com/', null);
      expect(result?.platform).toBe('copilot');
    });

    it('identifies You.com from you.com', () => {
      const result = identifyAiSource('https://you.com/search?q=foo', null);
      expect(result?.platform).toBe('you');
    });

    it('identifies Brave Search AI from search.brave.com', () => {
      const result = identifyAiSource('https://search.brave.com/search?q=foo', null);
      expect(result?.platform).toBe('brave');
    });

    it('identifies Grok from grok.com', () => {
      const result = identifyAiSource('https://grok.com/', null);
      expect(result?.platform).toBe('grok');
    });

    it('identifies DeepSeek from chat.deepseek.com', () => {
      const result = identifyAiSource('https://chat.deepseek.com/', null);
      expect(result?.platform).toBe('deepseek');
    });

    it('identifies Meta AI from meta.ai', () => {
      const result = identifyAiSource('https://meta.ai/', null);
      expect(result?.platform).toBe('meta-ai');
    });

    it('identifies Mistral from chat.mistral.ai', () => {
      const result = identifyAiSource('https://chat.mistral.ai/chat/abc', null);
      expect(result?.platform).toBe('mistral');
    });

    it('identifies Phind from phind.com', () => {
      const result = identifyAiSource('https://www.phind.com/search?q=foo', null);
      expect(result?.platform).toBe('phind');
    });

    it('is case-insensitive on referrer host', () => {
      const result = identifyAiSource('https://ChatGPT.com/', null);
      expect(result?.platform).toBe('chatgpt');
    });
  });

  describe('identifyAiSource — utm_source fallback', () => {
    it('identifies ChatGPT from utm_source=chatgpt.com when referrer is missing', () => {
      const result = identifyAiSource(null, 'chatgpt.com');
      expect(result).toEqual({ platform: 'chatgpt', displayName: 'ChatGPT', via: 'utm' });
    });

    it('identifies ChatGPT from utm_source=chatgpt', () => {
      const result = identifyAiSource(null, 'chatgpt');
      expect(result?.platform).toBe('chatgpt');
    });

    it('identifies Perplexity from utm_source=perplexity', () => {
      const result = identifyAiSource('', 'perplexity');
      expect(result?.platform).toBe('perplexity');
    });

    it('identifies Gemini from utm_source=gemini', () => {
      const result = identifyAiSource(null, 'gemini');
      expect(result?.platform).toBe('gemini');
    });

    it('is case-insensitive on utm_source', () => {
      const result = identifyAiSource(null, 'CHATGPT.COM');
      expect(result?.platform).toBe('chatgpt');
    });

    it('trims whitespace on utm_source', () => {
      const result = identifyAiSource(null, '  perplexity  ');
      expect(result?.platform).toBe('perplexity');
    });

    it('prefers referrer over utm_source when both present', () => {
      const result = identifyAiSource('https://claude.ai/', 'chatgpt');
      expect(result?.platform).toBe('claude');
      expect(result?.via).toBe('referrer');
    });
  });

  describe('identifyAiSource — negative cases', () => {
    it('returns null for null inputs', () => {
      expect(identifyAiSource(null, null)).toBeNull();
    });

    it('returns null for undefined inputs', () => {
      expect(identifyAiSource(undefined, undefined)).toBeNull();
    });

    it('returns null for empty strings', () => {
      expect(identifyAiSource('', '')).toBeNull();
    });

    it('returns null for non-AI referrer', () => {
      expect(identifyAiSource('https://example.com/', null)).toBeNull();
    });

    it('returns null for unknown utm_source', () => {
      expect(identifyAiSource(null, 'facebook')).toBeNull();
    });

    it('returns null for malformed referrer URL (bare string)', () => {
      expect(identifyAiSource('not a url', null)).toBeNull();
    });

    it('returns null for malformed referrer URL (garbage)', () => {
      expect(identifyAiSource('://://', null)).toBeNull();
    });

    it('returns null for Google Search (non-AI)', () => {
      expect(identifyAiSource('https://www.google.com/search?q=foo', null)).toBeNull();
    });

    it('returns null for plain bing.com (non-chat)', () => {
      expect(identifyAiSource('https://www.bing.com/search?q=foo', null)).toBeNull();
    });

    it('returns null for youtube.com (starts with "you" but is not you.com)', () => {
      expect(identifyAiSource('https://www.youtube.com/watch?v=abc', null)).toBeNull();
    });
  });

  describe('getAiSourceDictionary', () => {
    it('returns all AI source definitions', () => {
      const dictionary = getAiSourceDictionary();
      expect(dictionary.length).toBeGreaterThanOrEqual(13);
    });

    it('has unique platform slugs', () => {
      const dictionary = getAiSourceDictionary();
      const platforms = dictionary.map((d) => d.platform);
      expect(new Set(platforms).size).toBe(platforms.length);
    });

    it('every source has required fields', () => {
      for (const source of getAiSourceDictionary()) {
        expect(source.platform).toBeTruthy();
        expect(source.displayName).toBeTruthy();
        expect(source.hosts.length).toBeGreaterThan(0);
        expect(source.pattern).toBeInstanceOf(RegExp);
      }
    });
  });

  describe('getPlatformDisplayName', () => {
    it('returns the display name for a known platform', () => {
      expect(getPlatformDisplayName('chatgpt')).toBe('ChatGPT');
    });

    it('falls back to the slug for unknown platforms', () => {
      expect(getPlatformDisplayName('unknown')).toBe('unknown');
    });
  });
});
