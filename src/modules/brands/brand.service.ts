import { eq, and, desc, isNull, ilike } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { db } from '@/lib/db';
import { paginationConfig, sortConfig, countTotal } from '@/lib/db/query-helpers';
import { brand } from './brand.schema';
import { dispatchWebhookEvent } from '@/modules/webhooks/webhook.service';

export function generateBrandSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'brand'}-${suffix}`;
}

const SORT_COLUMNS = {
  createdAt: brand.createdAt,
  name: brand.name,
};

export const BRAND_ALLOWED_SORTS = Object.keys(SORT_COLUMNS);

export async function createBrand(
  workspaceId: string,
  input: {
    name: string;
    domain?: string;
    aliases?: string[];
    description?: string;
    metadata?: Record<string, unknown>;
  },
  boss?: PgBoss
) {
  // Check name uniqueness among active brands
  const existing = await db
    .select({ id: brand.id })
    .from(brand)
    .where(
      and(eq(brand.workspaceId, workspaceId), eq(brand.name, input.name), isNull(brand.deletedAt))
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Brand name already exists in this workspace');
  }

  const slug = generateBrandSlug(input.name);

  const [created] = await db
    .insert(brand)
    .values({
      workspaceId,
      name: input.name,
      slug,
      domain: input.domain ?? null,
      aliases: input.aliases ?? [],
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    })
    .returning({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      domain: brand.domain,
      aliases: brand.aliases,
      description: brand.description,
      metadata: brand.metadata,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    });

  if (boss) {
    await dispatchWebhookEvent(workspaceId, 'brand.created', { brand: created }, boss);
  }

  return created;
}

export async function listBrands(
  workspaceId: string,
  pagination: { page: number; limit: number; sort?: string; order: 'asc' | 'desc' },
  search?: string
) {
  const conditions = [eq(brand.workspaceId, workspaceId), isNull(brand.deletedAt)];

  if (search) {
    conditions.push(ilike(brand.name, `%${search}%`));
  }

  const { limit, offset } = paginationConfig(pagination);
  const orderBy = sortConfig(pagination, SORT_COLUMNS);

  const [items, total] = await Promise.all([
    db
      .select({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        domain: brand.domain,
        aliases: brand.aliases,
        description: brand.description,
        metadata: brand.metadata,
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
      })
      .from(brand)
      .where(and(...conditions))
      .orderBy(orderBy ?? desc(brand.createdAt))
      .limit(limit)
      .offset(offset),
    countTotal(brand, conditions),
  ]);

  return { items, total };
}

export async function getBrand(brandId: string, workspaceId: string) {
  const [record] = await db
    .select({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      domain: brand.domain,
      aliases: brand.aliases,
      description: brand.description,
      metadata: brand.metadata,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    })
    .from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.workspaceId, workspaceId), isNull(brand.deletedAt)))
    .limit(1);

  return record ?? null;
}

export async function updateBrand(
  brandId: string,
  workspaceId: string,
  input: {
    name?: string;
    domain?: string | null;
    aliases?: string[];
    description?: string | null;
    metadata?: Record<string, unknown>;
  },
  boss?: PgBoss
) {
  // Check name uniqueness if name is changing
  if (input.name) {
    const existing = await db
      .select({ id: brand.id })
      .from(brand)
      .where(
        and(eq(brand.workspaceId, workspaceId), eq(brand.name, input.name), isNull(brand.deletedAt))
      )
      .limit(1);

    if (existing.length > 0 && existing[0].id !== brandId) {
      throw new Error('Brand name already exists in this workspace');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) {
    updateData.name = input.name;
    updateData.slug = generateBrandSlug(input.name);
  }
  if (input.domain !== undefined) updateData.domain = input.domain;
  if (input.aliases !== undefined) updateData.aliases = input.aliases;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.metadata !== undefined) updateData.metadata = input.metadata;

  const [updated] = await db
    .update(brand)
    .set(updateData)
    .where(and(eq(brand.id, brandId), eq(brand.workspaceId, workspaceId), isNull(brand.deletedAt)))
    .returning({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      domain: brand.domain,
      aliases: brand.aliases,
      description: brand.description,
      metadata: brand.metadata,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    });

  if (!updated) return null;

  if (boss) {
    await dispatchWebhookEvent(workspaceId, 'brand.updated', { brand: updated }, boss);
  }

  return updated;
}

export async function deleteBrand(brandId: string, workspaceId: string, boss?: PgBoss) {
  const now = new Date();

  const [deleted] = await db
    .update(brand)
    .set({ deletedAt: now })
    .where(and(eq(brand.id, brandId), eq(brand.workspaceId, workspaceId), isNull(brand.deletedAt)))
    .returning({
      id: brand.id,
      name: brand.name,
    });

  if (!deleted) return false;

  if (boss) {
    await dispatchWebhookEvent(
      workspaceId,
      'brand.deleted',
      { brand: { ...deleted, deletedAt: now.toISOString() } },
      boss
    );
  }

  return true;
}
