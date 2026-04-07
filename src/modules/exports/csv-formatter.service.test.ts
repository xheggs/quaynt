// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { formatCsv, sanitizeValue, escapeField } from './csv-formatter.service';
import type { ExportColumnDef } from './export.types';

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const bytes = await streamToBytes(stream);
  // Use ignoreBOM: false to preserve BOM in output for testing
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  return decoder.decode(bytes);
}

const testColumns: ExportColumnDef[] = [
  { key: 'name', i18nKey: 'exports.columns.brandName' },
  { key: 'value', i18nKey: 'exports.columns.currentValue' },
];

const testHeaders: Record<string, string> = {
  'exports.columns.brandName': 'Brand',
  'exports.columns.currentValue': 'Current Value',
};

async function* asyncRows(
  rows: Record<string, unknown>[]
): AsyncGenerator<Record<string, unknown>> {
  for (const row of rows) {
    yield row;
  }
}

describe('sanitizeValue', () => {
  it('prefixes = with single quote', () => {
    expect(sanitizeValue('=SUM(1+1)')).toBe("'=SUM(1+1)");
  });

  it('prefixes + with single quote', () => {
    expect(sanitizeValue('+cmd|calc')).toBe("'+cmd|calc");
  });

  it('prefixes - with single quote', () => {
    expect(sanitizeValue('-exec')).toBe("'-exec");
  });

  it('prefixes @ with single quote', () => {
    expect(sanitizeValue('@import')).toBe("'@import");
  });

  it('prefixes tab with single quote', () => {
    expect(sanitizeValue('\tsomething')).toBe("'\tsomething");
  });

  it('prefixes carriage return with single quote', () => {
    expect(sanitizeValue('\rsomething')).toBe("'\rsomething");
  });

  it('does not modify safe values', () => {
    expect(sanitizeValue('hello world')).toBe('hello world');
    expect(sanitizeValue('123')).toBe('123');
    expect(sanitizeValue('')).toBe('');
  });
});

describe('escapeField', () => {
  it('quotes fields containing commas', () => {
    expect(escapeField('hello, world')).toBe('"hello, world"');
  });

  it('quotes fields containing double quotes and escapes them', () => {
    expect(escapeField('say "hello"')).toBe('"say ""hello"""');
  });

  it('quotes fields containing newlines', () => {
    expect(escapeField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('quotes fields containing carriage returns', () => {
    expect(escapeField('line1\rline2')).toBe('"line1\rline2"');
  });

  it('does not quote simple fields', () => {
    expect(escapeField('hello')).toBe('hello');
    expect(escapeField('123')).toBe('123');
  });
});

describe('formatCsv', () => {
  it('emits UTF-8 BOM at the start', async () => {
    const stream = formatCsv(asyncRows([]), testColumns, testHeaders);
    const bytes = await streamToBytes(stream);
    // UTF-8 BOM is EF BB BF
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
  });

  it('emits header row with translated column names', async () => {
    const stream = formatCsv(asyncRows([]), testColumns, testHeaders);
    const output = await streamToString(stream);
    const lines = output.split('\r\n');
    // First line after BOM is the header
    expect(lines[0].replace(/^\uFEFF/, '')).toBe('Brand,Current Value');
  });

  it('returns header row only for empty dataset', async () => {
    const stream = formatCsv(asyncRows([]), testColumns, testHeaders);
    const output = await streamToString(stream);
    const lines = output.split('\r\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1); // header only
  });

  it('emits data rows with correct values', async () => {
    const rows = [
      { name: 'Acme', value: '50.00' },
      { name: 'Beta Corp', value: '30.00' },
    ];
    const stream = formatCsv(asyncRows(rows), testColumns, testHeaders);
    const output = await streamToString(stream);
    const lines = output.split('\r\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toBe('Acme,50.00');
    expect(lines[2]).toBe('Beta Corp,30.00');
  });

  it('uses CRLF line endings', async () => {
    const rows = [{ name: 'Acme', value: '50.00' }];
    const stream = formatCsv(asyncRows(rows), testColumns, testHeaders);
    const output = await streamToString(stream);
    // Each line should end with \r\n
    expect(output).toContain('\r\n');
    // Should not have bare \n without \r
    const withoutCRLF = output.replace(/\r\n/g, '');
    expect(withoutCRLF).not.toContain('\n');
  });

  it('handles null and undefined values as empty strings', async () => {
    const rows = [{ name: null, value: undefined }];
    const stream = formatCsv(
      asyncRows(rows as unknown as Record<string, unknown>[]),
      testColumns,
      testHeaders
    );
    const output = await streamToString(stream);
    const lines = output.split('\r\n').filter((l) => l.length > 0);
    expect(lines[1]).toBe(',');
  });

  it('handles Date values as ISO date strings', async () => {
    const rows = [{ name: 'Acme', value: new Date('2026-03-15T00:00:00Z') }];
    const stream = formatCsv(asyncRows(rows), testColumns, testHeaders);
    const output = await streamToString(stream);
    const lines = output.split('\r\n').filter((l) => l.length > 0);
    expect(lines[1]).toBe('Acme,2026-03-15');
  });

  it('sanitizes CSV injection in cell values', async () => {
    const rows = [{ name: '=SUM(A1:A10)', value: '+cmd|calc' }];
    const stream = formatCsv(asyncRows(rows), testColumns, testHeaders);
    const output = await streamToString(stream);
    const lines = output.split('\r\n').filter((l) => l.length > 0);
    // Values with dangerous prefixes should be prefixed with single quote
    expect(lines[1]).toContain("'=SUM(A1:A10)");
    expect(lines[1]).toContain("'+cmd|calc");
  });

  it('quotes and escapes fields with commas and quotes', async () => {
    const rows = [{ name: 'Acme, Inc.', value: 'say "hello"' }];
    const stream = formatCsv(asyncRows(rows), testColumns, testHeaders);
    const output = await streamToString(stream);
    const lines = output.split('\r\n').filter((l) => l.length > 0);
    expect(lines[1]).toBe('"Acme, Inc.","say ""hello"""');
  });

  it('handles unicode values correctly', async () => {
    const rows = [{ name: 'Ünïcödé', value: '日本語' }];
    const stream = formatCsv(asyncRows(rows), testColumns, testHeaders);
    const output = await streamToString(stream);
    const lines = output.split('\r\n').filter((l) => l.length > 0);
    expect(lines[1]).toBe('Ünïcödé,日本語');
  });

  it('falls back to key name when header translation is missing', async () => {
    const columns: ExportColumnDef[] = [{ key: 'name', i18nKey: 'exports.columns.missing' }];
    const stream = formatCsv(asyncRows([]), columns, {});
    const output = await streamToString(stream);
    const lines = output.split('\r\n').filter((l) => l.length > 0);
    expect(lines[0].replace(/^\uFEFF/, '')).toBe('name');
  });
});
