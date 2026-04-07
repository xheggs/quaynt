import type { ExportColumnDef } from './export.types';

export interface JsonMetaOptions {
  exportType: string;
  format: 'json' | 'jsonl';
  filters: Record<string, string | undefined>;
  columns: ExportColumnDef[];
  headers: Record<string, string>;
  truncated: boolean;
  rowLimit: number;
}

/**
 * Build the metadata object for the JSON export envelope.
 * Column labels are resolved from the pre-loaded i18n headers map.
 */
export function buildJsonMeta(options: JsonMetaOptions): Record<string, unknown> {
  const { exportType, format, filters, columns, headers, truncated, rowLimit } = options;

  return {
    exportType,
    format,
    generatedAt: new Date().toISOString(),
    filters,
    columns: columns.map((col) => ({
      key: col.key,
      label: headers[col.i18nKey] ?? col.key,
      i18nKey: col.i18nKey,
    })),
    truncated,
    rowLimit,
  };
}

/**
 * Format an async iterable of rows into a streaming JSON response with metadata envelope.
 *
 * Output structure: `{"meta":{...},"data":[{row1},{row2},...]}`
 *
 * Uses a pull-based ReadableStream for backpressure support, matching the CSV formatter pattern.
 *
 * @param rows - Async iterable of row objects
 * @param meta - Pre-built metadata object from buildJsonMeta()
 * @returns ReadableStream of UTF-8 encoded JSON bytes
 */
export function formatJson(
  rows: AsyncIterable<Record<string, unknown>>,
  meta: Record<string, unknown>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let iterator: AsyncIterator<Record<string, unknown>>;
  let headerEmitted = false;
  let firstRow = true;

  return new ReadableStream<Uint8Array>({
    start() {
      iterator = rows[Symbol.asyncIterator]();
    },

    async pull(controller) {
      if (!headerEmitted) {
        const opening = JSON.stringify({ meta }).slice(0, -1) + ',"data":[';
        controller.enqueue(encoder.encode(opening));
        headerEmitted = true;
      }

      const BATCH_SIZE = 100;
      for (let i = 0; i < BATCH_SIZE; i++) {
        const { done, value } = await iterator.next();
        if (done) {
          controller.enqueue(encoder.encode(']}'));
          controller.close();
          return;
        }
        const prefix = firstRow ? '' : ',';
        firstRow = false;
        controller.enqueue(encoder.encode(prefix + JSON.stringify(value)));
      }
    },
  });
}

/**
 * Format an async iterable of rows into a streaming JSONL (newline-delimited JSON) response.
 * Each row is one JSON object per line, separated by '\n'. No envelope or framing.
 *
 * @param rows - Async iterable of row objects
 * @returns ReadableStream of UTF-8 encoded JSONL bytes
 */
export function formatJsonl(
  rows: AsyncIterable<Record<string, unknown>>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let iterator: AsyncIterator<Record<string, unknown>>;

  return new ReadableStream<Uint8Array>({
    start() {
      iterator = rows[Symbol.asyncIterator]();
    },

    async pull(controller) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < BATCH_SIZE; i++) {
        const { done, value } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'));
      }
    },
  });
}
