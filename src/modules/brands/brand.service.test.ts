// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock('@/lib/db', () => {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy });
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockReturnValue([]);
  mockOrderBy.mockReturnValue({ limit: mockLimit });
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockReturning });

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

vi.mock('./brand.schema', () => ({
  brand: {
    id: 'id',
    workspaceId: 'workspaceId',
    name: 'name',
    slug: 'slug',
    domain: 'domain',
    aliases: 'aliases',
    description: 'description',
    metadata: 'metadata',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@/lib/db/query-helpers', () => ({
  paginationConfig: vi.fn().mockReturnValue({ limit: 25, offset: 0 }),
  sortConfig: vi.fn().mockReturnValue(undefined),
  countTotal: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/modules/webhooks/webhook.service', () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue({ eventId: 'evt_test', deliveryIds: [] }),
}));

const sampleBrand = {
  id: 'brand_test123',
  name: 'Acme Corp',
  slug: 'acme-corp-abc123',
  domain: 'acme.example.com',
  aliases: ['Acme', 'Acme Corporation'],
  description: 'A test brand',
  metadata: {},
  createdAt: new Date('2026-04-02T12:00:00Z'),
  updatedAt: new Date('2026-04-02T12:00:00Z'),
};

describe('brand service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock chains
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockReturnValue([]);
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockReturning.mockReturnValue([]);
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockReturning });
  });

  describe('generateBrandSlug', () => {
    it('generates a slug with random suffix', async () => {
      const { generateBrandSlug } = await import('./brand.service');
      const slug = generateBrandSlug('Acme Corp');
      expect(slug).toMatch(/^acme-corp-[a-z0-9]+$/);
    });

    it('handles special characters', async () => {
      const { generateBrandSlug } = await import('./brand.service');
      const slug = generateBrandSlug("O'Reilly Media!");
      expect(slug).toMatch(/^o-reilly-media-[a-z0-9]+$/);
    });

    it('generates unique slugs for same input', async () => {
      const { generateBrandSlug } = await import('./brand.service');
      const slug1 = generateBrandSlug('Test');
      const slug2 = generateBrandSlug('Test');
      expect(slug1).not.toBe(slug2);
    });

    it('falls back to brand for empty name', async () => {
      const { generateBrandSlug } = await import('./brand.service');
      const slug = generateBrandSlug('!!!');
      expect(slug).toMatch(/^brand-[a-z0-9]+$/);
    });
  });

  describe('createBrand', () => {
    it('creates brand with all fields', async () => {
      // First call: uniqueness check returns empty
      mockLimit.mockReturnValueOnce([]);
      // After insert, returning gives us the brand
      mockReturning.mockReturnValueOnce([sampleBrand]);

      const { createBrand } = await import('./brand.service');
      const result = await createBrand('ws_test', {
        name: 'Acme Corp',
        domain: 'acme.example.com',
        aliases: ['Acme', 'Acme Corporation'],
        description: 'A test brand',
      });

      expect(result).toEqual(sampleBrand);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('creates brand with minimum fields', async () => {
      const minBrand = { ...sampleBrand, domain: null, aliases: [], description: null };
      mockLimit.mockReturnValueOnce([]);
      mockReturning.mockReturnValueOnce([minBrand]);

      const { createBrand } = await import('./brand.service');
      const result = await createBrand('ws_test', { name: 'Acme Corp' });

      expect(result).toEqual(minBrand);
    });

    it('throws on duplicate name within same workspace', async () => {
      mockLimit.mockReturnValueOnce([{ id: 'brand_existing' }]);

      const { createBrand } = await import('./brand.service');
      await expect(createBrand('ws_test', { name: 'Acme Corp' })).rejects.toThrow(
        'Brand name already exists in this workspace'
      );
    });
  });

  describe('listBrands', () => {
    it('returns paginated results', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(2);
      mockOffset.mockReturnValueOnce([sampleBrand, { ...sampleBrand, id: 'brand_test456' }]);

      const { listBrands } = await import('./brand.service');
      const result = await listBrands('ws_test', {
        page: 1,
        limit: 25,
        order: 'desc',
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('passes search filter', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(1);
      mockOffset.mockReturnValueOnce([sampleBrand]);

      const { listBrands } = await import('./brand.service');
      const result = await listBrands('ws_test', { page: 1, limit: 25, order: 'desc' }, 'Acme');

      expect(result.items).toHaveLength(1);
    });
  });

  describe('getBrand', () => {
    it('returns brand by ID', async () => {
      mockLimit.mockReturnValueOnce([sampleBrand]);

      const { getBrand } = await import('./brand.service');
      const result = await getBrand('brand_test123', 'ws_test');

      expect(result).toEqual(sampleBrand);
    });

    it('returns null for non-existent brand', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { getBrand } = await import('./brand.service');
      const result = await getBrand('brand_nonexistent', 'ws_test');

      expect(result).toBeNull();
    });

    it('returns null for soft-deleted brand', async () => {
      // The service queries with isNull(deletedAt), so soft-deleted brands
      // won't match. The mock returns empty to simulate this.
      mockLimit.mockReturnValueOnce([]);

      const { getBrand } = await import('./brand.service');
      const result = await getBrand('brand_deleted', 'ws_test');

      expect(result).toBeNull();
    });
  });

  describe('updateBrand', () => {
    it('updates brand name and regenerates slug', async () => {
      // Uniqueness check returns empty
      mockLimit.mockReturnValueOnce([]);
      // Update returning
      const updated = { ...sampleBrand, name: 'New Name', slug: 'new-name-xyz789' };
      mockReturning.mockReturnValueOnce([updated]);

      const { updateBrand } = await import('./brand.service');
      const result = await updateBrand('brand_test123', 'ws_test', {
        name: 'New Name',
      });

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('updates aliases only', async () => {
      const updated = { ...sampleBrand, aliases: ['New Alias'] };
      mockReturning.mockReturnValueOnce([updated]);

      const { updateBrand } = await import('./brand.service');
      const result = await updateBrand('brand_test123', 'ws_test', {
        aliases: ['New Alias'],
      });

      expect(result).toEqual(updated);
    });

    it('returns null for non-existent brand', async () => {
      mockReturning.mockReturnValueOnce([]);

      const { updateBrand } = await import('./brand.service');
      const result = await updateBrand('brand_nonexistent', 'ws_test', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });

    it('throws on duplicate name when updating', async () => {
      // Uniqueness check returns a different brand with the same name
      mockLimit.mockReturnValueOnce([{ id: 'brand_other' }]);

      const { updateBrand } = await import('./brand.service');
      await expect(
        updateBrand('brand_test123', 'ws_test', { name: 'Existing Name' })
      ).rejects.toThrow('Brand name already exists in this workspace');
    });
  });

  describe('deleteBrand', () => {
    it('soft deletes brand', async () => {
      mockReturning.mockReturnValueOnce([{ id: 'brand_test123', name: 'Acme Corp' }]);

      const { deleteBrand } = await import('./brand.service');
      const result = await deleteBrand('brand_test123', 'ws_test');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns false for non-existent brand', async () => {
      mockReturning.mockReturnValueOnce([]);

      const { deleteBrand } = await import('./brand.service');
      const result = await deleteBrand('brand_nonexistent', 'ws_test');

      expect(result).toBe(false);
    });
  });
});
