// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { identifyBot, getBotDictionary } from './crawler-bot-dictionary';

describe('crawler-bot-dictionary', () => {
  describe('identifyBot', () => {
    it('identifies GPTBot', () => {
      const result = identifyBot(
        'Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'
      );
      expect(result).toEqual({ name: 'GPTBot', category: 'search', operator: 'OpenAI' });
    });

    it('identifies OAI-SearchBot before GPTBot', () => {
      const result = identifyBot('OAI-SearchBot/1.0');
      expect(result).toEqual({ name: 'OAI-SearchBot', category: 'search', operator: 'OpenAI' });
    });

    it('identifies ChatGPT-User', () => {
      const result = identifyBot('Mozilla/5.0 ChatGPT-User/1.0');
      expect(result).toEqual({ name: 'ChatGPT-User', category: 'user_action', operator: 'OpenAI' });
    });

    it('identifies ClaudeBot', () => {
      const result = identifyBot('ClaudeBot/1.0');
      expect(result).toEqual({ name: 'ClaudeBot', category: 'search', operator: 'Anthropic' });
    });

    it('identifies Claude-SearchBot before ClaudeBot', () => {
      const result = identifyBot('Claude-SearchBot/1.0');
      expect(result).toEqual({
        name: 'Claude-SearchBot',
        category: 'search',
        operator: 'Anthropic',
      });
    });

    it('identifies Claude-User', () => {
      const result = identifyBot('Claude-User/1.0');
      expect(result).toEqual({
        name: 'Claude-User',
        category: 'user_action',
        operator: 'Anthropic',
      });
    });

    it('identifies anthropic-ai as training bot', () => {
      const result = identifyBot('anthropic-ai/1.0');
      expect(result).toEqual({ name: 'anthropic-ai', category: 'training', operator: 'Anthropic' });
    });

    it('identifies PerplexityBot', () => {
      const result = identifyBot('PerplexityBot/1.0');
      expect(result).toEqual({ name: 'PerplexityBot', category: 'search', operator: 'Perplexity' });
    });

    it('identifies Google-Extended', () => {
      const result = identifyBot('Mozilla/5.0 (compatible; Google-Extended)');
      expect(result).toEqual({ name: 'Google-Extended', category: 'search', operator: 'Google' });
    });

    it('identifies Applebot-Extended', () => {
      const result = identifyBot('Mozilla/5.0 (compatible; Applebot-Extended/1.0)');
      expect(result).toEqual({ name: 'Applebot-Extended', category: 'search', operator: 'Apple' });
    });

    it('identifies CCBot as training', () => {
      const result = identifyBot('CCBot/2.0 (https://commoncrawl.org/faq/)');
      expect(result).toEqual({ name: 'CCBot', category: 'training', operator: 'Common Crawl' });
    });

    it('identifies Bytespider as training', () => {
      const result = identifyBot('Bytespider/1.0');
      expect(result).toEqual({ name: 'Bytespider', category: 'training', operator: 'ByteDance' });
    });

    it('identifies Meta-ExternalAgent', () => {
      const result = identifyBot('Meta-ExternalAgent/1.0');
      expect(result).toEqual({
        name: 'Meta-ExternalAgent',
        category: 'training',
        operator: 'Meta',
      });
    });

    it('identifies Amazonbot', () => {
      const result = identifyBot('Mozilla/5.0 (compatible; Amazonbot/0.1)');
      expect(result).toEqual({ name: 'Amazonbot', category: 'training', operator: 'Amazon' });
    });

    it('identifies case-insensitively', () => {
      const result = identifyBot('gptbot/1.0');
      expect(result).toEqual({ name: 'GPTBot', category: 'search', operator: 'OpenAI' });
    });

    // --- Exclusion tests ---

    it('returns null for Googlebot', () => {
      expect(identifyBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBeNull();
    });

    it('returns null for bingbot', () => {
      expect(identifyBot('Mozilla/5.0 (compatible; bingbot/2.0)')).toBeNull();
    });

    it('returns null for DuckDuckBot', () => {
      expect(identifyBot('DuckDuckBot/1.0')).toBeNull();
    });

    it('returns null for regular browser user agent', () => {
      expect(
        identifyBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
      ).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(identifyBot('')).toBeNull();
    });

    it('returns null for unknown bot', () => {
      expect(identifyBot('MyCustomBot/1.0')).toBeNull();
    });
  });

  describe('getBotDictionary', () => {
    it('returns all bot definitions', () => {
      const dictionary = getBotDictionary();
      expect(dictionary.length).toBeGreaterThanOrEqual(22);
    });

    it('has unique bot names', () => {
      const dictionary = getBotDictionary();
      const names = dictionary.map((b) => b.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('every bot has required fields', () => {
      const dictionary = getBotDictionary();
      for (const bot of dictionary) {
        expect(bot.name).toBeTruthy();
        expect(bot.category).toMatch(/^(search|training|user_action)$/);
        expect(bot.operator).toBeTruthy();
        expect(bot.pattern).toBeInstanceOf(RegExp);
      }
    });
  });
});
