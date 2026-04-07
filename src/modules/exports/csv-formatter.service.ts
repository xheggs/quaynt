import type { ExportColumnDef } from './export.types';

const UTF8_BOM = '\uFEFF';
const CRLF = '\r\n';
const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitize a cell value to prevent CSV injection.
 * Values starting with dangerous characters are prefixed with a single quote,
 * which Excel and Google Sheets treat as a text-prefix indicator.
 */
export function sanitizeValue(value: string): string {
  if (value.length > 0 && DANGEROUS_PREFIXES.includes(value[0])) {
    return `'${value}`;
  }
  return value;
}

/**
 * Escape a field value per RFC 4180.
 * Fields containing commas, double quotes, or newlines are enclosed in double quotes.
 * Double quotes within the field are escaped by doubling them.
 */
export function escapeField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value);
  return escapeField(sanitizeValue(str));
}

function buildRow(fields: string[]): string {
  return fields.join(',') + CRLF;
}

/**
 * Format an async iterable of rows into a streaming RFC 4180-compliant CSV.
 * Uses a pull-based ReadableStream for backpressure support.
 *
 * @param rows - Async iterable of row objects
 * @param columns - Column definitions mapping row keys to i18n header keys
 * @param headers - Pre-resolved map of i18nKey → translated header string
 * @returns ReadableStream of UTF-8 encoded CSV bytes
 */
export function formatCsv(
  rows: AsyncIterable<Record<string, unknown>>,
  columns: ExportColumnDef[],
  headers: Record<string, string>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let iterator: AsyncIterator<Record<string, unknown>>;
  let headerEmitted = false;

  return new ReadableStream<Uint8Array>({
    start() {
      iterator = rows[Symbol.asyncIterator]();
    },

    async pull(controller) {
      if (!headerEmitted) {
        const headerFields = columns.map((col) => escapeField(headers[col.i18nKey] ?? col.key));
        controller.enqueue(encoder.encode(UTF8_BOM + buildRow(headerFields)));
        headerEmitted = true;
      }

      const BATCH_SIZE = 100;
      for (let i = 0; i < BATCH_SIZE; i++) {
        const { done, value } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        const fields = columns.map((col) => formatCell(value[col.key]));
        controller.enqueue(encoder.encode(buildRow(fields)));
      }
    },
  });
}
