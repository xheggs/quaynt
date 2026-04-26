import { describe, it, expect } from 'vitest';
import { normalizeDomain, registrableDomain } from './domain';

describe('normalizeDomain', () => {
  it.each([
    ['example.com', 'example.com', 'https://example.com'],
    ['EXAMPLE.com', 'example.com', 'https://example.com'],
    ['https://example.com/', 'example.com', 'https://example.com'],
    ['https://example.com/about', 'example.com', 'https://example.com'],
    ['  example.com  ', 'example.com', 'https://example.com'],
    ['http://example.com', 'example.com', 'https://example.com'],
    ['sub.example.co.uk', 'sub.example.co.uk', 'https://sub.example.co.uk'],
    ['xn--n3h.com', 'xn--n3h.com', 'https://xn--n3h.com'],
  ])('accepts %s', (input, expectedHost, expectedBaseUrl) => {
    const result = normalizeDomain(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.host).toBe(expectedHost);
      expect(result.baseUrl).toBe(expectedBaseUrl);
    }
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['localhost', 'localhost'],
    ['127.0.0.1', 'is_ip'],
    ['::1', 'invalid_url'],
    ['example', 'no_dot'],
    ['foo.localhost', 'reserved_tld'],
    ['foo.test', 'reserved_tld'],
    ['foo.invalid', 'reserved_tld'],
    ['foo..com', 'invalid_label'],
    ['-foo.com', 'invalid_label'],
    ['foo.-com', 'invalid_label'],
    ['ftp://foo.com', 'invalid_url'],
  ])('rejects %s with code %s', (input, code) => {
    const result = normalizeDomain(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
  });
});

describe('registrableDomain', () => {
  it.each([
    ['example.com', 'example.com'],
    ['www.example.com', 'example.com'],
    ['a.b.c.example.com', 'example.com'],
    ['EXAMPLE.COM', 'example.com'],
    ['localhost', 'localhost'],
  ])('%s → %s', (input, expected) => {
    expect(registrableDomain(input)).toBe(expected);
  });
});
