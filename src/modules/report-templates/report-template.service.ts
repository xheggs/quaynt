import { eq, and, isNull, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { reportTemplate } from './report-template.schema';
import { REPORT_SECTIONS } from '@/modules/pdf/pdf.types';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateSectionConfig,
  TemplateLayout,
  TemplateBranding,
} from './report-template.types';
import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '@/lib/config/env';

const log = logger.child({ module: 'report-templates' });

const MAX_TEMPLATES_PER_WORKSPACE = 25;

/**
 * Backfill sections: ensure all REPORT_SECTIONS are present.
 * Missing sections are appended with visible: false for forward-compat.
 */
function backfillSections(layout: TemplateLayout): TemplateLayout {
  const existingIds = new Set(layout.sections.map((s) => s.id));
  const missing: TemplateSectionConfig[] = REPORT_SECTIONS.filter((id) => !existingIds.has(id)).map(
    (id) => ({ id, visible: false })
  );

  if (missing.length === 0) return layout;

  return {
    sections: [...layout.sections, ...missing],
  };
}

export async function createTemplate(
  workspaceId: string,
  userId: string,
  input: CreateTemplateInput
): Promise<typeof reportTemplate.$inferSelect> {
  // Check workspace template limit
  const [{ value: templateCount }] = await db
    .select({ value: count() })
    .from(reportTemplate)
    .where(and(eq(reportTemplate.workspaceId, workspaceId), isNull(reportTemplate.deletedAt)));

  if (templateCount >= MAX_TEMPLATES_PER_WORKSPACE) {
    throw new TemplateLimitError(MAX_TEMPLATES_PER_WORKSPACE);
  }

  // Strip logoUploadId from branding before storing (it's handled by the route)
  const cleanBranding: TemplateBranding = {};
  if (input.branding) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripping client-only field before DB storage
    const { logoUploadId: _uploadId, ...rest } = input.branding;
    Object.assign(cleanBranding, rest);
  }

  const [created] = await db
    .insert(reportTemplate)
    .values({
      workspaceId,
      createdBy: userId,
      name: input.name,
      description: input.description,
      layout: input.layout as TemplateLayout,
      branding: cleanBranding,
      coverOverrides: input.coverOverrides,
    })
    .returning();

  log.info({ templateId: created.id, workspaceId }, 'Template created');
  return created;
}

export async function getTemplate(
  workspaceId: string,
  templateId: string
): Promise<typeof reportTemplate.$inferSelect | null> {
  const [template] = await db
    .select()
    .from(reportTemplate)
    .where(
      and(
        eq(reportTemplate.id, templateId),
        eq(reportTemplate.workspaceId, workspaceId),
        isNull(reportTemplate.deletedAt)
      )
    )
    .limit(1);

  if (!template) return null;

  // Backfill missing sections
  return {
    ...template,
    layout: backfillSections(template.layout),
  };
}

export async function listTemplates(
  workspaceId: string
): Promise<
  Pick<
    typeof reportTemplate.$inferSelect,
    'id' | 'name' | 'description' | 'createdAt' | 'updatedAt'
  >[]
> {
  return db
    .select({
      id: reportTemplate.id,
      name: reportTemplate.name,
      description: reportTemplate.description,
      createdAt: reportTemplate.createdAt,
      updatedAt: reportTemplate.updatedAt,
    })
    .from(reportTemplate)
    .where(and(eq(reportTemplate.workspaceId, workspaceId), isNull(reportTemplate.deletedAt)));
}

export async function updateTemplate(
  workspaceId: string,
  templateId: string,
  input: UpdateTemplateInput
): Promise<typeof reportTemplate.$inferSelect | null> {
  // Build update values, only including provided fields
  const updateValues: Record<string, unknown> = {};

  if (input.name !== undefined) updateValues.name = input.name;
  if (input.description !== undefined) updateValues.description = input.description;
  if (input.layout !== undefined) updateValues.layout = input.layout;
  if (input.coverOverrides !== undefined) updateValues.coverOverrides = input.coverOverrides;

  if (input.branding !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripping client-only field before DB storage
    const { logoUploadId: _uploadId, ...brandingValues } = input.branding;
    updateValues.branding = brandingValues;
  }

  if (Object.keys(updateValues).length === 0) {
    return getTemplate(workspaceId, templateId);
  }

  updateValues.updatedAt = new Date();

  const [updated] = await db
    .update(reportTemplate)
    .set(updateValues)
    .where(
      and(
        eq(reportTemplate.id, templateId),
        eq(reportTemplate.workspaceId, workspaceId),
        isNull(reportTemplate.deletedAt)
      )
    )
    .returning();

  if (!updated) return null;

  return {
    ...updated,
    layout: backfillSections(updated.layout),
  };
}

export async function deleteTemplate(workspaceId: string, templateId: string): Promise<boolean> {
  const [deleted] = await db
    .update(reportTemplate)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(reportTemplate.id, templateId),
        eq(reportTemplate.workspaceId, workspaceId),
        isNull(reportTemplate.deletedAt)
      )
    )
    .returning({ id: reportTemplate.id });

  if (!deleted) return false;

  log.info({ templateId, workspaceId }, 'Template soft-deleted');
  return true;
}

export async function duplicateTemplate(
  workspaceId: string,
  templateId: string,
  userId: string
): Promise<typeof reportTemplate.$inferSelect> {
  const source = await getTemplate(workspaceId, templateId);
  if (!source) {
    throw new TemplateNotFoundError();
  }

  // Check limit before creating
  const [{ value: templateCount }] = await db
    .select({ value: count() })
    .from(reportTemplate)
    .where(and(eq(reportTemplate.workspaceId, workspaceId), isNull(reportTemplate.deletedAt)));

  if (templateCount >= MAX_TEMPLATES_PER_WORKSPACE) {
    throw new TemplateLimitError(MAX_TEMPLATES_PER_WORKSPACE);
  }

  // Copy logo file if present
  let newBranding = { ...source.branding };
  if (source.branding.logoPath) {
    const srcPath = join(env.REPORT_STORAGE_PATH, source.branding.logoPath);
    if (existsSync(srcPath)) {
      // Generate a new path for the duplicated template's logo
      const { generatePrefixedId } = await import('@/lib/db/id');
      const newId = generatePrefixedId('reportTemplate');
      const newLogoPath = `logos/${workspaceId}/${newId}.png`;
      const destPath = join(env.REPORT_STORAGE_PATH, newLogoPath);
      try {
        await copyFile(srcPath, destPath);
        newBranding = { ...newBranding, logoPath: newLogoPath };
      } catch (err) {
        log.warn({ err, templateId }, 'Failed to copy logo during duplicate, skipping');
        newBranding = { ...newBranding, logoPath: undefined };
      }
    }
  }

  const duplicateName = `${source.name} (copy)`;

  const [created] = await db
    .insert(reportTemplate)
    .values({
      workspaceId,
      createdBy: userId,
      name: duplicateName,
      description: source.description,
      layout: source.layout,
      branding: newBranding,
      coverOverrides: source.coverOverrides,
    })
    .returning();

  log.info({ templateId: created.id, sourceId: templateId, workspaceId }, 'Template duplicated');
  return created;
}

// --- Error classes ---

export class TemplateLimitError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(`Maximum ${limit} templates per workspace`);
    this.name = 'TemplateLimitError';
    this.limit = limit;
  }
}

export class TemplateNotFoundError extends Error {
  constructor() {
    super('Report template not found');
    this.name = 'TemplateNotFoundError';
  }
}
