// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { formatJson, formatJsonl, buildJsonMeta } from './json-formatter.service';
import type { ExportColumnDef } from './export.types';

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
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
  return new TextDecoder('utf-8').decode(result);
}

const testColumns: ExportColumnDef[] = [
  { key: 'brandName', i18nKey: 'exports.columns.brandName' },
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

describe('buildJsonMeta', () => {
  it('constructs correct metadata object', () => {
    const before = new Date().toISOString();
    const meta = buildJsonMeta({
      exportType: 'citations',
      format: 'json',
      filters: { brandId: 'brand_abc', from: '2026-01-01', to: '2026-03-31' },
      columns: testColumns,
      headers: testHeaders,
      truncated: false,
      rowLimit: 100000,
    });
    const after = new Date().toISOString();

    expect(meta.exportType).toBe('citations');
    expect(meta.format).toBe('json');
    expect(meta.truncated).toBe(false);
    expect(meta.rowLimit).toBe(100000);
    expect((meta.generatedAt as string) >= before).toBe(true);
    expect((meta.generatedAt as string) <= after).toBe(true);
    expect(meta.filters).toEqual({ brandId: 'brand_abc', from: '2026-01-01', to: '2026-03-31' });
  });

  it('resolves column labels from headers map', () => {
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: {},
      columns: testColumns,
      headers: testHeaders,
      truncated: false,
      rowLimit: 100000,
    });

    const cols = meta.columns as Array<{ key: string; label: string; i18nKey: string }>;
    expect(cols).toHaveLength(2);
    expect(cols[0]).toEqual({
      key: 'brandName',
      label: 'Brand',
      i18nKey: 'exports.columns.brandName',
    });
    expect(cols[1]).toEqual({
      key: 'value',
      label: 'Current Value',
      i18nKey: 'exports.columns.currentValue',
    });
  });

  it('falls back to key name when header translation is missing', () => {
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: {},
      columns: [{ key: 'unknown', i18nKey: 'exports.columns.missing' }],
      headers: {},
      truncated: false,
      rowLimit: 100000,
    });

    const cols = meta.columns as Array<{ key: string; label: string }>;
    expect(cols[0].label).toBe('unknown');
  });
});

describe('formatJson', () => {
  it('outputs valid JSON with metadata envelope for non-empty dataset', async () => {
    const rows = [
      { brandName: 'Acme', value: 50 },
      { brandName: 'Beta Corp', value: 30 },
    ];
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: { from: '2026-01-01' },
      columns: testColumns,
      headers: testHeaders,
      truncated: false,
      rowLimit: 100000,
    });

    const stream = formatJson(asyncRows(rows), meta);
    const output = await streamToString(stream);
    const parsed = JSON.parse(output);

    expect(parsed.meta).toBeDefined();
    expect(parsed.data).toBeDefined();
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0]).toEqual({ brandName: 'Acme', value: 50 });
    expect(parsed.data[1]).toEqual({ brandName: 'Beta Corp', value: 30 });
  });

  it('meta includes correct fields', async () => {
    const meta = buildJsonMeta({
      exportType: 'citations',
      format: 'json',
      filters: { brandId: 'b1' },
      columns: testColumns,
      headers: testHeaders,
      truncated: true,
      rowLimit: 100000,
    });

    const stream = formatJson(asyncRows([]), meta);
    const output = await streamToString(stream);
    const parsed = JSON.parse(output);

    expect(parsed.meta.exportType).toBe('citations');
    expect(parsed.meta.format).toBe('json');
    expect(parsed.meta.generatedAt).toBeDefined();
    expect(parsed.meta.filters).toEqual({ brandId: 'b1' });
    expect(parsed.meta.truncated).toBe(true);
    expect(parsed.meta.rowLimit).toBe(100000);
    expect(parsed.meta.columns).toHaveLength(2);
    expect(parsed.meta.columns[0].label).toBe('Brand');
  });

  it('produces valid JSON with empty data array for empty dataset', async () => {
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: {},
      columns: testColumns,
      headers: testHeaders,
      truncated: false,
      rowLimit: 100000,
    });

    const stream = formatJson(asyncRows([]), meta);
    const output = await streamToString(stream);
    const parsed = JSON.parse(output);

    expect(parsed.data).toEqual([]);
  });

  it('preserves data types (numbers as numbers, nulls as null)', async () => {
    const rows = [{ brandName: 'Acme', value: 42, extra: null }];
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: {},
      columns: testColumns,
      headers: testHeaders,
      truncated: false,
      rowLimit: 100000,
    });

    const stream = formatJson(asyncRows(rows), meta);
    const output = await streamToString(stream);
    const parsed = JSON.parse(output);

    expect(typeof parsed.data[0].value).toBe('number');
    expect(parsed.data[0].extra).toBeNull();
  });

  it('handles special characters via JSON.stringify', async () => {
    const rows = [{ brandName: 'Acme "Inc"\nNew Line', value: '日本語\t\u0000' }];
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: {},
      columns: testColumns,
      headers: testHeaders,
      truncated: false,
      rowLimit: 100000,
    });

    const stream = formatJson(asyncRows(rows), meta);
    const output = await streamToString(stream);
    const parsed = JSON.parse(output);

    expect(parsed.data[0].brandName).toBe('Acme "Inc"\nNew Line');
    expect(parsed.data[0].value).toContain('日本語');
  });

  it('does not emit UTF-8 BOM', async () => {
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: {},
      columns: testColumns,
      headers: testHeaders,
      truncated: false,
      rowLimit: 100000,
    });

    const stream = formatJson(asyncRows([]), meta);
    const reader = stream.getReader();
    const { value } = await reader.read();
    reader.releaseLock();

    // UTF-8 BOM would be EF BB BF
    expect(value![0]).not.toBe(0xef);
  });

  it('streams correctly with many rows', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      brandName: `Brand ${i}`,
      value: i,
    }));
    const meta = buildJsonMeta({
      exportType: 'report',
      format: 'json',
      filters: {},
      columns: testColumns,
      headers: testHeaders,
      truncated: false,
      rowLimit: 100000,
    });

    const stream = formatJson(asyncRows(rows), meta);
    const output = await streamToString(stream);
    const parsed = JSON.parse(output);

    expect(parsed.data).toHaveLength(500);
    expect(parsed.data[0].brandName).toBe('Brand 0');
    expect(parsed.data[499].brandName).toBe('Brand 499');
  });
});

describe('formatJsonl', () => {
  it('emits each row as a valid JSON object on its own line', async () => {
    const rows = [
      { brandName: 'Acme', value: 50 },
      { brandName: 'Beta Corp', value: 30 },
    ];

    const stream = formatJsonl(asyncRows(rows));
    const output = await streamToString(stream);
    const lines = output.split('\n').filter((l) => l.length > 0);

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ brandName: 'Acme', value: 50 });
    expect(JSON.parse(lines[1])).toEqual({ brandName: 'Beta Corp', value: 30 });
  });

  it('separates lines with newline character', async () => {
    const rows = [{ brandName: 'Acme', value: 1 }];

    const stream = formatJsonl(asyncRows(rows));
    const output = await streamToString(stream);

    expect(output).toBe('{"brandName":"Acme","value":1}\n');
  });

  it('has no array brackets or commas between records', async () => {
    const rows = [
      { brandName: 'A', value: 1 },
      { brandName: 'B', value: 2 },
    ];

    const stream = formatJsonl(asyncRows(rows));
    const output = await streamToString(stream);

    expect(output).not.toContain('[');
    expect(output).not.toContain(']');
    // No comma between lines (commas within JSON objects are fine)
    const lines = output.split('\n').filter((l) => l.length > 0);
    for (const line of lines) {
      // Each line should be independently parseable
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('produces zero output for empty dataset', async () => {
    const stream = formatJsonl(asyncRows([]));
    const output = await streamToString(stream);

    expect(output).toBe('');
    expect(output.length).toBe(0);
  });

  it('streams correctly with 1000+ rows', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      brandName: `Brand ${i}`,
      value: i,
    }));

    const stream = formatJsonl(asyncRows(rows));
    const output = await streamToString(stream);
    const lines = output.split('\n').filter((l) => l.length > 0);

    expect(lines).toHaveLength(1500);
    expect(JSON.parse(lines[0]).brandName).toBe('Brand 0');
    expect(JSON.parse(lines[1499]).brandName).toBe('Brand 1499');
  });

  it('preserves data types in each line', async () => {
    const rows = [{ name: 'Test', count: 42, active: true, extra: null }];

    const stream = formatJsonl(asyncRows(rows));
    const output = await streamToString(stream);
    const parsed = JSON.parse(output.trim());

    expect(typeof parsed.count).toBe('number');
    expect(typeof parsed.active).toBe('boolean');
    expect(parsed.extra).toBeNull();
  });

  it('handles special characters via JSON.stringify', async () => {
    const rows = [{ name: 'Quote "test"\nNewline', value: 'Ünïcödé 日本語' }];

    const stream = formatJsonl(asyncRows(rows));
    const output = await streamToString(stream);
    const parsed = JSON.parse(output.trim());

    expect(parsed.name).toBe('Quote "test"\nNewline');
    expect(parsed.value).toBe('Ünïcödé 日本語');
  });
});
