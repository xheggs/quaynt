import sharp from 'sharp';
import { mkdir, writeFile, rename, unlink, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { init } from '@paralleldrive/cuid2';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'template-logo' });
const createUploadId = init({ length: 16 });

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const LOGO_MAX_WIDTH = 400;
const LOGO_MAX_HEIGHT = 200;

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);

/**
 * Upload a logo to the staging directory.
 * Validates MIME type and size, resizes to max 400x200, converts to PNG.
 * Returns an uploadId to reference later when creating/updating a template.
 */
export async function uploadLogoToStaging(
  workspaceId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ uploadId: string }> {
  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new LogoValidationError('Logo must be PNG, JPEG, or SVG');
  }

  // Validate size
  if (fileBuffer.length > MAX_LOGO_SIZE) {
    throw new LogoValidationError('Logo file exceeds 2MB limit');
  }

  // Process with sharp: resize and convert to PNG
  // sharp handles SVG rasterization automatically
  const processedBuffer = await sharp(fileBuffer)
    .resize(LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  // Write to staging path
  const uploadId = createUploadId();
  const stagingDir = join(env.REPORT_STORAGE_PATH, 'logos', workspaceId, 'staging');
  await mkdir(stagingDir, { recursive: true });

  const stagingPath = join(stagingDir, `${uploadId}.png`);
  await writeFile(stagingPath, processedBuffer);

  log.info(
    {
      uploadId,
      workspaceId,
      originalSize: fileBuffer.length,
      processedSize: processedBuffer.length,
    },
    'Logo uploaded to staging'
  );

  return { uploadId };
}

/**
 * Move a logo from staging to its final location for a template.
 * Returns the relative logo path (relative to REPORT_STORAGE_PATH).
 */
export async function commitStagingLogo(
  workspaceId: string,
  uploadId: string,
  templateId: string
): Promise<string> {
  const stagingPath = join(
    env.REPORT_STORAGE_PATH,
    'logos',
    workspaceId,
    'staging',
    `${uploadId}.png`
  );

  if (!existsSync(stagingPath)) {
    throw new LogoValidationError('Logo upload not found or expired — please re-upload');
  }

  const finalDir = join(env.REPORT_STORAGE_PATH, 'logos', workspaceId);
  await mkdir(finalDir, { recursive: true });

  const finalPath = join(finalDir, `${templateId}.png`);
  await rename(stagingPath, finalPath);

  const relativePath = `logos/${workspaceId}/${templateId}.png`;
  log.info({ uploadId, templateId, relativePath }, 'Logo committed from staging');

  return relativePath;
}

/**
 * Delete a logo file from disk.
 */
export async function deleteLogo(logoPath: string): Promise<void> {
  const fullPath = join(env.REPORT_STORAGE_PATH, logoPath);
  if (existsSync(fullPath)) {
    await unlink(fullPath);
    log.info({ logoPath }, 'Logo deleted');
  }
}

/**
 * Read a logo file from disk and return as Buffer for PDF embedding.
 * Returns undefined if the file is missing (graceful degradation).
 */
export async function resolveLogoBuffer(logoPath: string): Promise<Buffer | undefined> {
  const fullPath = join(env.REPORT_STORAGE_PATH, logoPath);
  try {
    return await readFile(fullPath);
  } catch {
    log.warn({ logoPath }, 'Logo file not found on disk, skipping');
    return undefined;
  }
}

// --- Error class ---

export class LogoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogoValidationError';
  }
}
