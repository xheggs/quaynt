// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizeUrl, extractDomain } from './url-normalize';

describe('normalizeUrl', () => {
  describe('core normalization', () => {
    it('strips www. prefix', () => {
      const result = normalizeUrl('https://www.example.com/page');
      expect(result).toEqual({
        normalizedUrl: 'https://example.com/page',
        domain: 'example.com',
      });
    });

    it('removes tracking parameters', () => {
      const result = normalizeUrl(
        'https://example.com/article?utm_source=twitter&utm_medium=social&id=42'
      );
      expect(result).toEqual({
        normalizedUrl: 'https://example.com/article?id=42',
        domain: 'example.com',
      });
    });

    it('removes all known tracking parameters', () => {
      const params = [
        'utm_source=a',
        'utm_medium=b',
        'utm_campaign=c',
        'utm_content=d',
        'utm_term=e',
        'ref=f',
        'fbclid=g',
        'gclid=h',
        'mc_cid=i',
        'mc_eid=j',
        'msclkid=k',
        'twclid=l',
        'dclid=m',
        'yclid=n',
        '_ga=o',
        '_gl=p',
      ].join('&');
      const result = normalizeUrl(`https://example.com/page?${params}`);
      expect(result!.normalizedUrl).toBe('https://example.com/page');
    });

    it('sorts remaining query parameters alphabetically', () => {
      const result = normalizeUrl('https://example.com/search?z=1&a=2&m=3');
      expect(result!.normalizedUrl).toBe('https://example.com/search?a=2&m=3&z=1');
    });

    it('removes URL fragment', () => {
      const result = normalizeUrl('https://example.com/article#section-2');
      expect(result!.normalizedUrl).toBe('https://example.com/article');
    });

    it('normalizes http to https', () => {
      const result = normalizeUrl('http://example.com/page');
      expect(result!.normalizedUrl).toBe('https://example.com/page');
    });

    it('removes trailing slash from path', () => {
      const result = normalizeUrl('https://example.com/page/');
      expect(result!.normalizedUrl).toBe('https://example.com/page');
    });

    it('preserves root path trailing slash', () => {
      const result = normalizeUrl('https://example.com/');
      expect(result!.normalizedUrl).toBe('https://example.com/');
    });

    it('applies all normalizations together', () => {
      const result = normalizeUrl(
        'http://www.example.com/article/?utm_source=twitter&id=42&ref=abc#comments'
      );
      expect(result).toEqual({
        normalizedUrl: 'https://example.com/article?id=42',
        domain: 'example.com',
      });
    });
  });

  describe('deduplication', () => {
    it('URLs differing only by tracking params normalize to the same result', () => {
      const a = normalizeUrl('https://example.com/article?id=1&utm_source=twitter');
      const b = normalizeUrl('https://example.com/article?id=1&fbclid=abc123');
      expect(a!.normalizedUrl).toBe(b!.normalizedUrl);
    });

    it('URLs differing only by www prefix normalize to the same result', () => {
      const a = normalizeUrl('https://www.example.com/page');
      const b = normalizeUrl('https://example.com/page');
      expect(a!.normalizedUrl).toBe(b!.normalizedUrl);
    });

    it('URLs differing only by protocol normalize to the same result', () => {
      const a = normalizeUrl('http://example.com/page');
      const b = normalizeUrl('https://example.com/page');
      expect(a!.normalizedUrl).toBe(b!.normalizedUrl);
    });

    it('URLs differing only by fragment normalize to the same result', () => {
      const a = normalizeUrl('https://example.com/page#top');
      const b = normalizeUrl('https://example.com/page#bottom');
      expect(a!.normalizedUrl).toBe(b!.normalizedUrl);
    });
  });

  describe('domain extraction', () => {
    it('extracts domain from standard URL', () => {
      expect(normalizeUrl('https://blog.example.com/post')!.domain).toBe('blog.example.com');
    });

    it('strips www from domain', () => {
      expect(normalizeUrl('https://www.example.com/')!.domain).toBe('example.com');
    });

    it('handles IP address as domain', () => {
      const result = normalizeUrl('https://192.168.1.1/page');
      expect(result!.domain).toBe('192.168.1.1');
    });

    it('handles internationalized domain names (punycode)', () => {
      const result = normalizeUrl('https://xn--n3h.example.com/page');
      expect(result!.domain).toBe('xn--n3h.example.com');
    });

    it('lowercases domain', () => {
      const result = normalizeUrl('https://EXAMPLE.COM/page');
      expect(result!.domain).toBe('example.com');
    });
  });

  describe('edge cases', () => {
    it('returns null for malformed URLs', () => {
      expect(normalizeUrl('not-a-url')).toBeNull();
      expect(normalizeUrl('')).toBeNull();
      expect(normalizeUrl('://missing-protocol')).toBeNull();
    });

    it('returns null for non-http protocols', () => {
      expect(normalizeUrl('ftp://example.com/file')).toBeNull();
      expect(normalizeUrl('mailto:user@example.com')).toBeNull();
    });

    it('handles URLs with empty query string', () => {
      const result = normalizeUrl('https://example.com/page?');
      expect(result!.normalizedUrl).toBe('https://example.com/page');
    });

    it('handles URLs with no path', () => {
      const result = normalizeUrl('https://example.com');
      expect(result!.normalizedUrl).toBe('https://example.com/');
      expect(result!.domain).toBe('example.com');
    });

    it('handles URLs with port numbers', () => {
      const result = normalizeUrl('https://example.com:8080/page');
      expect(result!.normalizedUrl).toBe('https://example.com:8080/page');
    });

    it('handles case-insensitive tracking param removal', () => {
      const result = normalizeUrl('https://example.com/page?UTM_SOURCE=test&id=1');
      expect(result!.normalizedUrl).toBe('https://example.com/page?id=1');
    });

    it('preserves path case', () => {
      const result = normalizeUrl('https://example.com/Page/Article');
      expect(result!.normalizedUrl).toBe('https://example.com/Page/Article');
    });

    it('handles multiple trailing slashes', () => {
      const result = normalizeUrl('https://example.com/page///');
      expect(result!.normalizedUrl).toBe('https://example.com/page');
    });
  });
});

describe('extractDomain', () => {
  it('returns the domain for a valid URL', () => {
    expect(extractDomain('https://www.example.com/page')).toBe('example.com');
  });

  it('returns null for a malformed URL', () => {
    expect(extractDomain('not-a-url')).toBeNull();
  });
});
