// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  parseApacheLine,
  parseCloudFrontLine,
  parseLine,
} from './crawler-log-parser';

describe('crawler-log-parser', () => {
  describe('detectFormat', () => {
    it('detects Apache/Nginx combined format', () => {
      const lines = [
        '66.249.66.1 - - [10/Oct/2025:13:55:36 -0700] "GET /about HTTP/1.1" 200 1234 "-" "GPTBot/1.0"',
        '66.249.66.2 - - [10/Oct/2025:13:55:37 -0700] "GET /contact HTTP/1.1" 200 5678 "-" "ClaudeBot/1.0"',
      ];
      expect(detectFormat(lines)).toBe('apache');
    });

    it('detects CloudFront format by header', () => {
      const lines = [
        '#Version: 1.0',
        '#Fields: date time x-edge-location sc-bytes c-ip cs-method cs(Host) cs-uri-stem sc-status cs(Referer) cs(User-Agent)',
      ];
      expect(detectFormat(lines)).toBe('cloudfront');
    });

    it('detects CloudFront format by tab-separated data', () => {
      const fields = Array(25).fill('value');
      const lines = [fields.join('\t')];
      expect(detectFormat(lines)).toBe('cloudfront');
    });

    it('returns null for empty input', () => {
      expect(detectFormat([])).toBeNull();
    });

    it('returns null for unrecognized format', () => {
      expect(detectFormat(['random text', 'more random text'])).toBeNull();
    });
  });

  describe('parseApacheLine', () => {
    it('parses a valid Apache combined log line', () => {
      const line =
        '66.249.66.1 - - [10/Oct/2025:13:55:36 -0700] "GET /about HTTP/1.1" 200 1234 "-" "GPTBot/1.0"';
      const result = parseApacheLine(line);

      expect(result).not.toBeNull();
      expect(result!.ip).toBe('66.249.66.1');
      expect(result!.method).toBe('GET');
      expect(result!.path).toBe('/about');
      expect(result!.statusCode).toBe(200);
      expect(result!.responseBytes).toBe(1234);
      expect(result!.userAgent).toBe('GPTBot/1.0');
      expect(result!.timestamp).toBeInstanceOf(Date);
    });

    it('handles missing response bytes (-)', () => {
      const line =
        '66.249.66.1 - - [10/Oct/2025:13:55:36 -0700] "GET /about HTTP/1.1" 304 - "-" "GPTBot/1.0"';
      const result = parseApacheLine(line);
      expect(result).not.toBeNull();
      expect(result!.responseBytes).toBe(0);
    });

    it('returns null for malformed line', () => {
      expect(parseApacheLine('this is not a log line')).toBeNull();
    });

    it('returns null for empty line', () => {
      expect(parseApacheLine('')).toBeNull();
    });

    it('handles POST method', () => {
      const line =
        '66.249.66.1 - - [10/Oct/2025:13:55:36 -0700] "POST /api/data HTTP/1.1" 201 42 "-" "PerplexityBot/1.0"';
      const result = parseApacheLine(line);
      expect(result).not.toBeNull();
      expect(result!.method).toBe('POST');
      expect(result!.statusCode).toBe(201);
    });

    it('captures a populated referer', () => {
      const line =
        '1.2.3.4 - - [10/Oct/2025:13:55:36 -0700] "GET /blog HTTP/1.1" 200 1024 "https://chatgpt.com/c/abc" "Mozilla/5.0"';
      const result = parseApacheLine(line);
      expect(result).not.toBeNull();
      expect(result!.referer).toBe('https://chatgpt.com/c/abc');
      expect(result!.userAgent).toBe('Mozilla/5.0');
    });

    it('normalizes empty referer ("-") to null', () => {
      const line =
        '1.2.3.4 - - [10/Oct/2025:13:55:36 -0700] "GET /blog HTTP/1.1" 200 1024 "-" "Mozilla/5.0"';
      const result = parseApacheLine(line);
      expect(result).not.toBeNull();
      expect(result!.referer).toBeNull();
    });
  });

  describe('parseCloudFrontLine', () => {
    it('parses a valid CloudFront log line', () => {
      const fields = [
        '2025-10-10', // date
        '13:55:36', // time
        'IAD12', // x-edge-location
        '1234', // sc-bytes
        '66.249.66.1', // c-ip
        'GET', // cs-method
        'example.com', // cs(Host)
        '/about', // cs-uri-stem
        '200', // sc-status
        '-', // cs(Referer)
        'GPTBot%2F1.0', // cs(User-Agent) URL-encoded
      ];
      const line = fields.join('\t');
      const result = parseCloudFrontLine(line);

      expect(result).not.toBeNull();
      expect(result!.ip).toBe('66.249.66.1');
      expect(result!.method).toBe('GET');
      expect(result!.path).toBe('/about');
      expect(result!.statusCode).toBe(200);
      expect(result!.responseBytes).toBe(1234);
      expect(result!.userAgent).toBe('GPTBot/1.0');
    });

    it('skips comment lines', () => {
      expect(parseCloudFrontLine('#Version: 1.0')).toBeNull();
      expect(parseCloudFrontLine('#Fields: date time')).toBeNull();
    });

    it('returns null for lines with too few fields', () => {
      expect(parseCloudFrontLine('a\tb\tc')).toBeNull();
    });

    it('captures a populated referer (URL-decoded)', () => {
      const fields = [
        '2025-10-10',
        '13:55:36',
        'IAD12',
        '1234',
        '66.249.66.1',
        'GET',
        'example.com',
        '/about',
        '200',
        'https%3A%2F%2Fchatgpt.com%2Fc%2Fabc',
        'Mozilla%2F5.0',
      ];
      const result = parseCloudFrontLine(fields.join('\t'));
      expect(result).not.toBeNull();
      expect(result!.referer).toBe('https://chatgpt.com/c/abc');
    });

    it('normalizes "-" referer to null', () => {
      const fields = [
        '2025-10-10',
        '13:55:36',
        'IAD12',
        '1234',
        '66.249.66.1',
        'GET',
        'example.com',
        '/about',
        '200',
        '-',
        'Mozilla%2F5.0',
      ];
      const result = parseCloudFrontLine(fields.join('\t'));
      expect(result).not.toBeNull();
      expect(result!.referer).toBeNull();
    });
  });

  describe('parseLine', () => {
    it('delegates to apache parser for apache format', () => {
      const line =
        '66.249.66.1 - - [10/Oct/2025:13:55:36 -0700] "GET /about HTTP/1.1" 200 1234 "-" "GPTBot/1.0"';
      const result = parseLine(line, 'apache');
      expect(result).not.toBeNull();
      expect(result!.path).toBe('/about');
    });

    it('delegates to apache parser for nginx format', () => {
      const line =
        '66.249.66.1 - - [10/Oct/2025:13:55:36 -0700] "GET /about HTTP/1.1" 200 1234 "-" "GPTBot/1.0"';
      const result = parseLine(line, 'nginx');
      expect(result).not.toBeNull();
    });

    it('delegates to cloudfront parser for cloudfront format', () => {
      const fields = Array(11).fill('value');
      fields[0] = '2025-10-10';
      fields[1] = '13:55:36';
      fields[3] = '1234';
      fields[4] = '66.249.66.1';
      fields[5] = 'GET';
      fields[7] = '/about';
      fields[8] = '200';
      fields[10] = 'GPTBot%2F1.0';
      const result = parseLine(fields.join('\t'), 'cloudfront');
      expect(result).not.toBeNull();
    });
  });
});
