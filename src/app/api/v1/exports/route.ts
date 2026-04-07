import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { badRequest, apiError } from '@/lib/api/response';
import { getRequestLogger } from '@/lib/logger';
import { formatCsv } from '@/modules/exports/csv-formatter.service';
import { exportColumns } from '@/modules/exports/export.columns';
import { fetchExportData } from '@/modules/exports/export.fetchers';
import { formatJson, formatJsonl, buildJsonMeta } from '@/modules/exports/json-formatter.service';
import {
  STREAMING_EXPORT_FORMATS,
  EXPORT_TYPES,
  MAX_EXPORT_ROWS,
  exportSchemas,
} from '@/modules/exports/export.types';
import type { ExportFormat, ExportType } from '@/modules/exports/export.types';

// API routes don't have React i18n context — load translations directly.
import exportMessages from '../../../../../locales/en/exports.json';

function loadColumnHeaders(): Record<string, string> {
  const columns = (exportMessages as { exports: { columns: Record<string, string> } }).exports
    .columns;
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(columns)) {
    headers[`exports.columns.${key}`] = value;
  }
  return headers;
}

const FORMAT_EXTENSIONS: Record<string, string> = {
  csv: '.csv',
  json: '.json',
  jsonl: '.jsonl',
};

function buildFilename(type: string, format: string, from?: string, to?: string): string {
  const parts = [type];
  if (from) parts.push(from);
  if (to) parts.push(to);
  return parts.join('_') + (FORMAT_EXTENSIONS[format] ?? `.${format}`);
}

export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const log = getRequestLogger(req);
          const params = req.nextUrl.searchParams;

          // Validate format
          const format = params.get('format') as ExportFormat | null;
          if (!format || !STREAMING_EXPORT_FORMATS.includes(format)) {
            return badRequest(
              `Unsupported export format: ${format ?? 'none'}. Supported formats: ${STREAMING_EXPORT_FORMATS.join(', ')}`
            );
          }

          // Validate type
          const type = params.get('type') as ExportType | null;
          if (!type || !EXPORT_TYPES.includes(type)) {
            return badRequest(
              `Unsupported export type: ${type ?? 'none'}. Supported types: ${EXPORT_TYPES.join(', ')}`
            );
          }

          // Build type-specific params (strip format and type from query params)
          const fetcherParams: Record<string, string | undefined> = {};
          for (const [key, value] of params.entries()) {
            if (key !== 'format' && key !== 'type') {
              fetcherParams[key] = value;
            }
          }

          // Validate type-specific params
          const schema = exportSchemas[type];
          const parsed = schema.safeParse(fetcherParams);
          if (!parsed.success) {
            const details = parsed.error.issues.map((i) => ({
              field: i.path.map(String).join('.'),
              message: i.message,
            }));
            return apiError('BAD_REQUEST', 'Invalid export parameters', 400, details);
          }

          let result;
          try {
            result = await fetchExportData(type, auth.workspaceId, fetcherParams);
          } catch (error) {
            log.error({ err: error }, 'Export data fetch failed');
            return apiError('INTERNAL_SERVER_ERROR', 'Export generation failed', 500);
          }

          // Build format-specific stream
          const columns = exportColumns[type];
          const headers = loadColumnHeaders();

          const CONTENT_TYPES: Record<string, string> = {
            csv: 'text/csv; charset=utf-8',
            json: 'application/json; charset=utf-8',
            jsonl: 'application/x-ndjson; charset=utf-8',
          };

          let stream: ReadableStream<Uint8Array>;
          if (format === 'json') {
            const meta = buildJsonMeta({
              exportType: type,
              format: 'json',
              filters: fetcherParams,
              columns,
              headers,
              truncated: result.truncated ?? false,
              rowLimit: MAX_EXPORT_ROWS,
            });
            stream = formatJson(result.rows, meta);
          } else if (format === 'jsonl') {
            stream = formatJsonl(result.rows);
          } else {
            stream = formatCsv(result.rows, columns, headers);
          }

          // Build response headers
          const filename = buildFilename(type, format, fetcherParams.from, fetcherParams.to);
          const responseHeaders = new Headers({
            'Content-Type': CONTENT_TYPES[format] ?? 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
          });

          if (result.truncated) {
            responseHeaders.set('X-Export-Truncated', 'true');
            responseHeaders.set('X-Export-Row-Limit', String(MAX_EXPORT_ROWS));
          }

          if (result.warnings && result.warnings.length > 0) {
            responseHeaders.set('X-Export-Warnings', result.warnings.join(', '));
          }

          return new NextResponse(stream, { status: 200, headers: responseHeaders });
        }, 'read'),
        { points: 20, duration: 60 }
      )
    )
  )
);
