import { NextResponse } from 'next/server';
import { withAuth, withScope, getAuthContext } from '@/lib/api/middleware';
import { withRateLimit } from '@/lib/api/rate-limit';
import { withRequestId } from '@/lib/api/request-id';
import { withRequestLog } from '@/lib/api/request-log';
import { apiCreated, apiSuccess, badRequest, conflict } from '@/lib/api/response';
import { apiErrors } from '@/lib/api/errors-i18n';
import { parsePagination, formatPaginatedResponse } from '@/lib/api/pagination';
import { getRequestLogger } from '@/lib/logger';
import { env } from '@/lib/config/env';
import { createBoss } from '@/lib/jobs/boss';
import { generatePrefixedId } from '@/lib/db/id';
import {
  stageFile,
  findByContentHash,
  createUpload,
  listUploads,
} from '@/modules/crawler/crawler-upload.service';
import { detectFormat } from '@/modules/crawler/crawler-log-parser';
import type { UploadStatus } from '@/modules/crawler/crawler.types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = ['.log', '.txt', '.gz'];

// POST /api/v1/crawler/uploads — upload a server log file
export const POST = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const t = await apiErrors();
          const log = getRequestLogger(req);

          let formData: FormData;
          try {
            formData = await req.formData();
          } catch {
            return badRequest(t('uploads.logFileExpected'));
          }

          const file = formData.get('logFile');
          if (!file || !(file instanceof File)) {
            return badRequest(t('uploads.logFileMissing'));
          }

          const filename = file.name;
          const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
            filename.toLowerCase().endsWith(ext)
          );
          if (!hasValidExtension) {
            return badRequest(t('uploads.invalidLogFileType'));
          }

          if (file.size > env.CRAWLER_MAX_UPLOAD_SIZE) {
            return NextResponse.json(
              { error: { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds maximum upload size' } },
              { status: 413 }
            );
          }

          const fileBuffer = Buffer.from(await file.arrayBuffer());

          // Stage file and compute content hash
          const tempId = generatePrefixedId('crawlerUpload');
          const contentHash = await stageFile(auth.workspaceId, tempId, fileBuffer);

          // Check for duplicate
          const existing = await findByContentHash(auth.workspaceId, contentHash);
          if (existing) {
            return conflict(t('uploads.duplicate', { existingId: existing.id }));
          }

          // Detect format (or use override)
          const formatOverride = formData.get('format') as string | null;
          let format = formatOverride ?? 'auto';
          if (format === 'auto') {
            const sampleText = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 8192));
            const sampleLines = sampleText.split('\n').slice(0, 10);
            const detected = detectFormat(sampleLines);
            format = detected ?? 'unknown';
          }

          // Create upload record
          const upload = await createUpload({
            workspaceId: auth.workspaceId,
            filename,
            format,
            sizeBytes: file.size,
            contentHash,
          });

          // Rename staging file to use the actual upload ID
          const { rename } = await import('node:fs/promises');
          const { getStagingPath } = await import('@/modules/crawler/crawler-upload.service');
          const oldPath = getStagingPath(auth.workspaceId, tempId);
          const newPath = getStagingPath(auth.workspaceId, upload.id);
          await rename(oldPath, newPath);

          // Enqueue parse job
          const boss = createBoss();
          await boss.send('crawler-parse', {
            workspaceId: auth.workspaceId,
            uploadId: upload.id,
          });

          log.info({ uploadId: upload.id, filename, format }, 'Crawler log upload created');

          return apiCreated({
            uploadId: upload.id,
            filename,
            format,
            status: 'pending',
          });
        }, 'read-write'),
        { points: 10, duration: 60 }
      )
    )
  )
);

// GET /api/v1/crawler/uploads — list uploads
export const GET = withRequestId(
  withRequestLog(
    withAuth(
      withRateLimit(
        withScope(async (req) => {
          const auth = getAuthContext(req);
          const url = new URL(req.url);

          const pagination = parsePagination(url.searchParams, ['createdAt']);
          if (pagination instanceof Response) return pagination;

          const status = url.searchParams.get('status') as UploadStatus | null;

          const { items, total } = await listUploads(
            auth.workspaceId,
            { status: status ?? undefined },
            pagination
          );

          return apiSuccess(
            formatPaginatedResponse(items, total, pagination.page, pagination.limit)
          );
        }, 'read')
      )
    )
  )
);
