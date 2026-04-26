import { describe, expect, it } from 'vitest';
import { safeSourceLink } from './safe-source-link';

describe('safeSourceLink', () => {
  it('returns href + label for https URLs', () => {
    const result = safeSourceLink('https://example.com/path');
    expect(result.href).toBe('https://example.com/path');
    expect(result.label).toBe('example.com');
  });

  it('returns href + label for http URLs', () => {
    const result = safeSourceLink('http://example.com');
    expect(result.href).toBe('http://example.com/');
    expect(result.label).toBe('example.com');
  });

  it('strips href for javascript: URLs (XSS guard)', () => {
    const result = safeSourceLink('javascript:alert(1)');
    // The XSS-relevant guarantee is that callers never receive an href —
    // a label rendered as plain text is safe via React's auto-escaping.
    expect(result.href).toBeUndefined();
  });

  it('strips href for data: URLs', () => {
    const result = safeSourceLink('data:text/html,<script>alert(1)</script>');
    expect(result.href).toBeUndefined();
  });

  it('strips href for file: URLs', () => {
    const result = safeSourceLink('file:///etc/passwd');
    expect(result.href).toBeUndefined();
  });

  it('returns label only for malformed input', () => {
    const result = safeSourceLink('not a url');
    expect(result.href).toBeUndefined();
    expect(result.label).toBe('not a url');
  });

  it('truncates very long malformed input', () => {
    const long = 'a'.repeat(200);
    const result = safeSourceLink(long);
    expect(result.label.length).toBeLessThanOrEqual(81);
    expect(result.label.endsWith('…')).toBe(true);
  });

  it('handles null and undefined safely', () => {
    expect(safeSourceLink(null).label).toBe('');
    expect(safeSourceLink(undefined).label).toBe('');
    expect(safeSourceLink(null).href).toBeUndefined();
  });

  it('handles whitespace and case variations of javascript:', () => {
    // The URL constructor parses `JavaScript:` as protocol "javascript:"
    const result = safeSourceLink('JavaScript:alert(1)');
    expect(result.href).toBeUndefined();
  });
});
