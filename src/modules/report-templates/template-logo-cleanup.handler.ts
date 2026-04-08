import type { PgBoss } from 'pg-boss';
import { and, lt, isNotNull } from 'drizzle-orm';
import { readdir, stat, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';
import { reportTemplate } from './report-template.schema';
import type { TemplateBranding } from './report-template.types';

const log = logger.child({ module: 'template-logo-cleanup' });

const STAGING_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SOFT_DELETE_RETENTION_DAYS = 30;

async function processLogoCleanup(): Promise<void> {
  const now = new Date();
  let stagingDeleted = 0;
  let orphanedDeleted = 0;

  // 1. Remove staging files older than 24 hours
  const logosDir = join(env.REPORT_STORAGE_PATH, 'logos');
  if (existsSync(logosDir)) {
    try {
      const workspaceDirs = await readdir(logosDir);
      for (const wsDir of workspaceDirs) {
        const stagingDir = join(logosDir, wsDir, 'staging');
        if (!existsSync(stagingDir)) continue;

        const files = await readdir(stagingDir);
        for (const file of files) {
          const filePath = join(stagingDir, file);
          try {
            const fileStat = await stat(filePath);
            if (now.getTime() - fileStat.mtimeMs > STAGING_MAX_AGE_MS) {
              await unlink(filePath);
              stagingDeleted++;
            }
          } catch (err) {
            log.warn({ filePath, err }, 'Failed to check/delete staging file');
          }
        }
      }
    } catch (err) {
      log.warn({ err }, 'Failed to scan staging directories');
    }
  }

  // 2. Remove logo files for templates soft-deleted more than 30 days ago
  const retentionThreshold = new Date();
  retentionThreshold.setDate(retentionThreshold.getDate() - SOFT_DELETE_RETENTION_DAYS);

  const deletedTemplates = await db
    .select({
      id: reportTemplate.id,
      branding: reportTemplate.branding,
    })
    .from(reportTemplate)
    .where(
      and(isNotNull(reportTemplate.deletedAt), lt(reportTemplate.deletedAt, retentionThreshold))
    );

  for (const template of deletedTemplates) {
    const branding = template.branding as TemplateBranding;
    if (branding?.logoPath) {
      const fullPath = join(env.REPORT_STORAGE_PATH, branding.logoPath);
      if (existsSync(fullPath)) {
        try {
          await unlink(fullPath);
          orphanedDeleted++;
        } catch (err) {
          log.warn(
            { templateId: template.id, logoPath: branding.logoPath, err },
            'Failed to delete orphaned logo'
          );
        }
      }
    }
  }

  log.info(
    { stagingDeleted, orphanedDeleted, deletedTemplatesChecked: deletedTemplates.length },
    'Logo cleanup completed'
  );
}

export async function registerLogoCleanupHandler(boss: PgBoss): Promise<void> {
  await boss.work('report-template-logo-cleanup', { includeMetadata: true }, async () => {
    await processLogoCleanup();
  });

  await boss.schedule('report-template-logo-cleanup', '0 5 * * *', {}, { retryLimit: 1 });
}
