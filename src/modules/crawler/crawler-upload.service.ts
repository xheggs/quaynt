import { createHash } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { eq, and, desc, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { paginationConfig, countTotal } from '@/lib/db/query-helpers';
import { crawlerUpload } from './crawler-upload.schema';
import type { UploadStatus } from './crawler.types';

const log = logger.child({ module: 'crawler-upload' });

function getStagingDir(workspaceId: string): string {
  return join(env.REPORT_STORAGE_PATH, 'crawler-logs', workspaceId);
}

export function getStagingPath(workspaceId: string, uploadId: string): string {
  return join(getStagingDir(workspaceId), uploadId);
}

/**
 * Stage a file to disk and compute its SHA-256 content hash.
 */
export async function stageFile(
  workspaceId: string,
  uploadId: string,
  buffer: Buffer
): Promise<string> {
  const dir = getStagingDir(workspaceId);
  await mkdir(dir, { recursive: true });

  const filePath = join(dir, uploadId);
  await writeFile(filePath, buffer);

  const contentHash = createHash('sha256').update(buffer).digest('hex');
  return contentHash;
}

/**
 * Delete the staging file after parsing.
 */
export async function deleteStagingFile(workspaceId: string, uploadId: string): Promise<void> {
  const filePath = getStagingPath(workspaceId, uploadId);
  if (existsSync(filePath)) {
    await unlink(filePath);
    log.debug({ uploadId }, 'Staging file deleted');
  }
}

/**
 * Check for duplicate upload by content hash within a workspace.
 */
export async function findByContentHash(
  workspaceId: string,
  contentHash: string
): Promise<{ id: string } | undefined> {
  const [existing] = await db
    .select({ id: crawlerUpload.id })
    .from(crawlerUpload)
    .where(
      and(eq(crawlerUpload.workspaceId, workspaceId), eq(crawlerUpload.contentHash, contentHash))
    )
    .limit(1);
  return existing;
}

/**
 * Create a new upload record.
 */
export async function createUpload(data: {
  workspaceId: string;
  filename: string;
  format: string;
  sizeBytes: number;
  contentHash: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(crawlerUpload)
    .values({
      workspaceId: data.workspaceId,
      filename: data.filename,
      format: data.format,
      sizeBytes: data.sizeBytes,
      contentHash: data.contentHash,
    })
    .returning({ id: crawlerUpload.id });
  return row;
}

/**
 * Get upload by ID, scoped to workspace.
 */
export async function getUpload(workspaceId: string, uploadId: string) {
  const [row] = await db
    .select()
    .from(crawlerUpload)
    .where(and(eq(crawlerUpload.id, uploadId), eq(crawlerUpload.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

/**
 * List uploads with pagination.
 */
export async function listUploads(
  workspaceId: string,
  filters: { status?: UploadStatus },
  pagination: { page: number; limit: number }
) {
  const conditions: SQL[] = [eq(crawlerUpload.workspaceId, workspaceId)];

  if (filters.status) {
    conditions.push(eq(crawlerUpload.status, filters.status));
  }

  const { limit, offset } = paginationConfig(pagination);

  const [items, total] = await Promise.all([
    db
      .select()
      .from(crawlerUpload)
      .where(and(...conditions))
      .orderBy(desc(crawlerUpload.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(crawlerUpload, conditions),
  ]);

  return { items, total };
}

/**
 * Update upload status and optional stats.
 */
export async function updateUploadStatus(
  uploadId: string,
  status: UploadStatus,
  stats?: {
    linesTotal?: number;
    linesParsed?: number;
    linesSkipped?: number;
    errorMessage?: string;
  }
) {
  await db
    .update(crawlerUpload)
    .set({ status, ...stats })
    .where(eq(crawlerUpload.id, uploadId));
}

/**
 * Cancel a pending/processing upload.
 * Returns true if the upload was successfully cancelled.
 */
export async function cancelUpload(workspaceId: string, uploadId: string): Promise<boolean> {
  const upload = await getUpload(workspaceId, uploadId);
  if (!upload) return false;
  if (upload.status !== 'pending' && upload.status !== 'processing') return false;

  await db.update(crawlerUpload).set({ status: 'cancelled' }).where(eq(crawlerUpload.id, uploadId));
  return true;
}

/**
 * Delete an upload record. Visits cascade via FK.
 */
export async function deleteUpload(workspaceId: string, uploadId: string): Promise<boolean> {
  const upload = await getUpload(workspaceId, uploadId);
  if (!upload) return false;

  await db
    .delete(crawlerUpload)
    .where(and(eq(crawlerUpload.id, uploadId), eq(crawlerUpload.workspaceId, workspaceId)));

  // Clean up staging file if it exists
  await deleteStagingFile(workspaceId, uploadId);

  log.info({ uploadId }, 'Upload and associated visits deleted');
  return true;
}
