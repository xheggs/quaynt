import type { LogFormat, ParsedLogLine } from './crawler.types';

/**
 * Apache/Nginx Combined Log Format regex.
 * Format: %h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"
 * Example: 66.249.66.1 - - [10/Oct/2025:13:55:36 -0700] "GET /about HTTP/1.1" 200 1234 "-" "GPTBot/1.0"
 */
const APACHE_NGINX_REGEX =
  /^(\S+) \S+ \S+ \[([^\]]+)] "(\w+) (\S+) HTTP\/[\d.]+" (\d+) (\d+|-) "([^"]*)" "([^"]*)"/;

function normalizeReferer(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-') return null;
  return trimmed;
}

/**
 * Detect log format from the first few non-empty lines.
 * CloudFront is identifiable by #Version:/#Fields: headers or 20+ tab-separated fields.
 */
export function detectFormat(lines: string[]): LogFormat | null {
  const sampleLines = lines.filter((line) => line.trim().length > 0).slice(0, 5);
  if (sampleLines.length === 0) return null;

  // CloudFront: look for version/fields headers or tab-separated data
  const hasCloudFrontHeader = sampleLines.some(
    (line) => line.startsWith('#Version:') || line.startsWith('#Fields:')
  );
  if (hasCloudFrontHeader) return 'cloudfront';

  // CloudFront data lines have 20+ tab-separated fields
  const tabSeparatedLine = sampleLines.find(
    (line) => !line.startsWith('#') && line.split('\t').length >= 20
  );
  if (tabSeparatedLine) return 'cloudfront';

  // Apache/Nginx: test against combined log format regex
  const matchesApache = sampleLines.some(
    (line) => !line.startsWith('#') && APACHE_NGINX_REGEX.test(line)
  );
  if (matchesApache) return 'apache';

  return null;
}

/**
 * Parse a single Apache/Nginx Combined Log Format line.
 * Returns null for malformed lines.
 */
export function parseApacheLine(line: string): ParsedLogLine | null {
  const match = line.match(APACHE_NGINX_REGEX);
  if (!match) return null;

  const [, ip, timestampStr, method, path, statusStr, bytesStr, refererRaw, userAgent] = match;

  const timestamp = parseApacheTimestamp(timestampStr);
  if (!timestamp) return null;

  return {
    ip,
    timestamp,
    method,
    path,
    statusCode: parseInt(statusStr, 10),
    responseBytes: bytesStr === '-' ? 0 : parseInt(bytesStr, 10),
    userAgent,
    referer: normalizeReferer(refererRaw),
  };
}

/**
 * Parse Apache timestamp format: 10/Oct/2025:13:55:36 -0700
 */
function parseApacheTimestamp(str: string): Date | null {
  const months: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const match = str.match(/^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
  if (!match) return null;

  const [, day, monthStr, year, hours, minutes, seconds, tz] = match;
  const month = months[monthStr];
  if (month === undefined) return null;

  // Build ISO 8601 string for reliable parsing
  const isoStr = `${year}-${String(month + 1).padStart(2, '0')}-${day}T${hours}:${minutes}:${seconds}${tz.slice(0, 3)}:${tz.slice(3)}`;
  const date = new Date(isoStr);

  return isNaN(date.getTime()) ? null : date;
}

/**
 * CloudFront Standard Log fields (tab-separated):
 * 0:date 1:time 2:x-edge-location 3:sc-bytes 4:c-ip 5:cs-method 6:cs(Host)
 * 7:cs-uri-stem 8:sc-status 9:cs(Referer) 10:cs(User-Agent) ...
 *
 * User-agent is URL-encoded in CloudFront logs.
 */
export function parseCloudFrontLine(line: string): ParsedLogLine | null {
  // Skip comment lines
  if (line.startsWith('#')) return null;

  const fields = line.split('\t');
  if (fields.length < 11) return null;

  const dateStr = fields[0]; // YYYY-MM-DD
  const timeStr = fields[1]; // HH:MM:SS
  const ip = fields[4];
  const method = fields[5];
  const path = fields[7];
  const statusStr = fields[8];
  const refererEncoded = fields[9];
  const userAgentEncoded = fields[10];

  if (!dateStr || !timeStr || !ip || !method || !path || !statusStr || !userAgentEncoded) {
    return null;
  }

  const timestamp = new Date(`${dateStr}T${timeStr}Z`);
  if (isNaN(timestamp.getTime())) return null;

  const statusCode = parseInt(statusStr, 10);
  if (isNaN(statusCode)) return null;

  const responseBytes = parseInt(fields[3] || '0', 10);

  let userAgent: string;
  try {
    userAgent = decodeURIComponent(userAgentEncoded.replace(/\+/g, ' '));
  } catch {
    userAgent = userAgentEncoded;
  }

  let refererDecoded: string | undefined;
  if (refererEncoded) {
    try {
      refererDecoded = decodeURIComponent(refererEncoded.replace(/\+/g, ' '));
    } catch {
      refererDecoded = refererEncoded;
    }
  }

  return {
    ip,
    timestamp,
    method,
    path,
    statusCode,
    responseBytes: isNaN(responseBytes) ? 0 : responseBytes,
    userAgent,
    referer: normalizeReferer(refererDecoded),
  };
}

/**
 * Parse a single log line using the specified format.
 * Returns null for malformed or unrecognized lines.
 */
export function parseLine(line: string, format: LogFormat): ParsedLogLine | null {
  switch (format) {
    case 'apache':
    case 'nginx':
      return parseApacheLine(line);
    case 'cloudfront':
      return parseCloudFrontLine(line);
  }
}
