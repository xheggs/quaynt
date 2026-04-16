/**
 * Client-side brand types mirroring the API response shape.
 * See: modules/brands/brand.schema.ts (database schema)
 * See: app/api/v1/brands/route.ts (API response)
 */

export interface Brand {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  aliases: string[];
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandInput {
  name: string;
  domain?: string;
  aliases?: string[];
  description?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateBrandInput = Partial<CreateBrandInput>;
