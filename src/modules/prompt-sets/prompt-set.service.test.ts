// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn();

// Helper to get the default where chain (for queries that continue with .limit/.orderBy)
const whereChain = () => ({ limit: mockLimit, orderBy: mockOrderBy });

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
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  mockDeleteWhere.mockReturnValue({ returning: mockReturning });

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };
});

vi.mock('./prompt-set.schema', () => ({
  promptSet: {
    id: 'id',
    workspaceId: 'workspaceId',
    name: 'name',
    description: 'description',
    tags: 'tags',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('./prompt.schema', () => ({
  prompt: {
    id: 'id',
    promptSetId: 'promptSetId',
    template: 'template',
    order: 'order',
    createdAt: 'createdAt',
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

const samplePromptSet = {
  id: 'ps_test123',
  name: 'Competitor Analysis',
  description: 'Track brand mentions',
  tags: ['competitor', 'weekly'],
  createdAt: new Date('2026-04-02T12:00:00Z'),
  updatedAt: new Date('2026-04-02T12:00:00Z'),
};

const samplePrompt = {
  id: 'prompt_test123',
  promptSetId: 'ps_test123',
  template: 'What is {{brand}} known for in {{market}}?',
  order: 0,
  createdAt: new Date('2026-04-02T12:00:00Z'),
};

describe('prompt set service', () => {
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
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockReturnValue({ returning: mockReturning });
  });

  describe('createPromptSet', () => {
    it('creates prompt set with all fields', async () => {
      // Uniqueness check: .where().limit() returns empty
      mockLimit.mockReturnValueOnce([]);
      // Insert returning
      mockReturning.mockReturnValueOnce([samplePromptSet]);

      const { createPromptSet } = await import('./prompt-set.service');
      const result = await createPromptSet('ws_test', {
        name: 'Competitor Analysis',
        description: 'Track brand mentions',
        tags: ['competitor', 'weekly'],
      });

      expect(result).toEqual(samplePromptSet);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('creates prompt set with minimum fields', async () => {
      const minSet = { ...samplePromptSet, description: null, tags: [] };
      mockLimit.mockReturnValueOnce([]);
      mockReturning.mockReturnValueOnce([minSet]);

      const { createPromptSet } = await import('./prompt-set.service');
      const result = await createPromptSet('ws_test', { name: 'Competitor Analysis' });

      expect(result).toEqual(minSet);
    });

    it('throws on duplicate name within same workspace', async () => {
      mockLimit.mockReturnValueOnce([{ id: 'ps_existing' }]);

      const { createPromptSet } = await import('./prompt-set.service');
      await expect(createPromptSet('ws_test', { name: 'Competitor Analysis' })).rejects.toThrow(
        'Prompt set name already exists in this workspace'
      );
    });
  });

  describe('listPromptSets', () => {
    it('returns paginated results', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(2);
      mockOffset.mockReturnValueOnce([samplePromptSet, { ...samplePromptSet, id: 'ps_test456' }]);

      const { listPromptSets } = await import('./prompt-set.service');
      const result = await listPromptSets('ws_test', {
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
      mockOffset.mockReturnValueOnce([samplePromptSet]);

      const { listPromptSets } = await import('./prompt-set.service');
      const result = await listPromptSets(
        'ws_test',
        { page: 1, limit: 25, order: 'desc' },
        { search: 'Competitor' }
      );

      expect(result.items).toHaveLength(1);
    });

    it('passes tag filter', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(1);
      mockOffset.mockReturnValueOnce([samplePromptSet]);

      const { listPromptSets } = await import('./prompt-set.service');
      const result = await listPromptSets(
        'ws_test',
        { page: 1, limit: 25, order: 'desc' },
        { tag: 'competitor' }
      );

      expect(result.items).toHaveLength(1);
    });

    it('excludes soft-deleted prompt sets', async () => {
      const { countTotal } = await import('@/lib/db/query-helpers');
      vi.mocked(countTotal).mockResolvedValueOnce(0);
      mockOffset.mockReturnValueOnce([]);

      const { listPromptSets } = await import('./prompt-set.service');
      const result = await listPromptSets('ws_test', {
        page: 1,
        limit: 25,
        order: 'desc',
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getPromptSet', () => {
    it('returns prompt set by ID with prompt count', async () => {
      // 1st .where() → main query chain (needs .limit())
      // 2nd .where() → count query (terminal, returns data)
      mockWhere.mockReturnValueOnce(whereChain()).mockReturnValueOnce([{ count: 5 }]);
      mockLimit.mockReturnValueOnce([samplePromptSet]);

      const { getPromptSet } = await import('./prompt-set.service');
      const result = await getPromptSet('ps_test123', 'ws_test');

      expect(result).toEqual({ ...samplePromptSet, promptCount: 5 });
    });

    it('returns null for non-existent prompt set', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { getPromptSet } = await import('./prompt-set.service');
      const result = await getPromptSet('ps_nonexistent', 'ws_test');

      expect(result).toBeNull();
    });

    it('returns null for soft-deleted prompt set', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { getPromptSet } = await import('./prompt-set.service');
      const result = await getPromptSet('ps_deleted', 'ws_test');

      expect(result).toBeNull();
    });
  });

  describe('updatePromptSet', () => {
    it('updates prompt set name', async () => {
      // Uniqueness check returns empty
      mockLimit.mockReturnValueOnce([]);
      const updated = { ...samplePromptSet, name: 'New Name' };
      mockReturning.mockReturnValueOnce([updated]);

      const { updatePromptSet } = await import('./prompt-set.service');
      const result = await updatePromptSet('ps_test123', 'ws_test', {
        name: 'New Name',
      });

      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('updates prompt set tags', async () => {
      const updated = { ...samplePromptSet, tags: ['new-tag'] };
      mockReturning.mockReturnValueOnce([updated]);

      const { updatePromptSet } = await import('./prompt-set.service');
      const result = await updatePromptSet('ps_test123', 'ws_test', {
        tags: ['new-tag'],
      });

      expect(result).toEqual(updated);
    });

    it('returns null for non-existent prompt set', async () => {
      mockReturning.mockReturnValueOnce([]);

      const { updatePromptSet } = await import('./prompt-set.service');
      const result = await updatePromptSet('ps_nonexistent', 'ws_test', {
        name: 'New Name',
      });

      expect(result).toBeNull();
    });

    it('throws on duplicate name when updating', async () => {
      mockLimit.mockReturnValueOnce([{ id: 'ps_other' }]);

      const { updatePromptSet } = await import('./prompt-set.service');
      await expect(
        updatePromptSet('ps_test123', 'ws_test', { name: 'Existing Name' })
      ).rejects.toThrow('Prompt set name already exists in this workspace');
    });
  });

  describe('deletePromptSet', () => {
    it('soft deletes prompt set', async () => {
      mockReturning.mockReturnValueOnce([{ id: 'ps_test123', name: 'Competitor Analysis' }]);

      const { deletePromptSet } = await import('./prompt-set.service');
      const result = await deletePromptSet('ps_test123', 'ws_test');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns false for non-existent prompt set', async () => {
      mockReturning.mockReturnValueOnce([]);

      const { deletePromptSet } = await import('./prompt-set.service');
      const result = await deletePromptSet('ps_nonexistent', 'ws_test');

      expect(result).toBe(false);
    });
  });

  describe('listPrompts', () => {
    it('returns ordered results', async () => {
      // 1st .where() → getActivePromptSet chain (needs .limit())
      // Default .where() handles both; .limit() returns parent, .orderBy() returns prompts
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);
      mockOrderBy.mockReturnValueOnce([
        samplePrompt,
        { ...samplePrompt, id: 'prompt_test456', order: 1 },
      ]);

      const { listPrompts } = await import('./prompt-set.service');
      const result = await listPrompts('ps_test123', 'ws_test');

      expect(result).toHaveLength(2);
    });

    it('returns null when parent set is soft-deleted', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { listPrompts } = await import('./prompt-set.service');
      const result = await listPrompts('ps_deleted', 'ws_test');

      expect(result).toBeNull();
    });
  });

  describe('addPrompt', () => {
    it('adds prompt with auto-assigned order', async () => {
      // 1st .where() → getActivePromptSet chain (needs .limit())
      // 2nd .where() → count check (terminal)
      // 3rd .where() → max order query (terminal)
      mockWhere
        .mockReturnValueOnce(whereChain())
        .mockReturnValueOnce([{ count: 3 }])
        .mockReturnValueOnce([{ maxOrder: 2 }]);
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);
      mockReturning.mockReturnValueOnce([{ ...samplePrompt, order: 3 }]);

      const { addPrompt } = await import('./prompt-set.service');
      const result = await addPrompt('ps_test123', 'ws_test', {
        template: 'What is {{brand}} known for?',
      });

      expect(result).toBeTruthy();
      expect(result!.order).toBe(3);
    });

    it('adds prompt with explicit order', async () => {
      // 1st .where() → getActivePromptSet chain (needs .limit())
      // 2nd .where() → count check (terminal)
      // No max order query when order is explicit
      mockWhere.mockReturnValueOnce(whereChain()).mockReturnValueOnce([{ count: 3 }]);
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);
      mockReturning.mockReturnValueOnce([{ ...samplePrompt, order: 10 }]);

      const { addPrompt } = await import('./prompt-set.service');
      const result = await addPrompt('ps_test123', 'ws_test', {
        template: 'What is {{brand}} known for?',
        order: 10,
      });

      expect(result).toBeTruthy();
      expect(result!.order).toBe(10);
    });

    it('returns null when parent set is soft-deleted', async () => {
      // getActivePromptSet returns null
      mockLimit.mockReturnValueOnce([]);

      const { addPrompt } = await import('./prompt-set.service');
      const result = await addPrompt('ps_deleted', 'ws_test', {
        template: 'What is {{brand}} known for?',
      });

      expect(result).toBeNull();
    });

    it('throws when set has 500 prompts', async () => {
      // 1st .where() → getActivePromptSet chain (needs .limit())
      // 2nd .where() → count check returns 500 (terminal)
      mockWhere.mockReturnValueOnce(whereChain()).mockReturnValueOnce([{ count: 500 }]);
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);

      const { addPrompt } = await import('./prompt-set.service');
      await expect(addPrompt('ps_test123', 'ws_test', { template: 'test' })).rejects.toThrow(
        'Prompt set has reached the maximum of 500 prompts'
      );
    });
  });

  describe('updatePrompt', () => {
    it('updates prompt template', async () => {
      // getActivePromptSet .where() needs chain
      mockWhere.mockReturnValueOnce(whereChain());
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);
      const updated = { ...samplePrompt, template: 'Updated {{brand}} template' };
      mockReturning.mockReturnValueOnce([updated]);

      const { updatePrompt } = await import('./prompt-set.service');
      const result = await updatePrompt('prompt_test123', 'ps_test123', 'ws_test', {
        template: 'Updated {{brand}} template',
      });

      expect(result).toEqual(updated);
    });

    it('returns null when parent set is soft-deleted', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { updatePrompt } = await import('./prompt-set.service');
      const result = await updatePrompt('prompt_test123', 'ps_deleted', 'ws_test', {
        template: 'Updated',
      });

      expect(result).toBeNull();
    });

    it('returns null for non-existent prompt', async () => {
      mockWhere.mockReturnValueOnce(whereChain());
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);
      mockReturning.mockReturnValueOnce([]);

      const { updatePrompt } = await import('./prompt-set.service');
      const result = await updatePrompt('prompt_nonexistent', 'ps_test123', 'ws_test', {
        template: 'Updated',
      });

      expect(result).toBeNull();
    });
  });

  describe('deletePrompt', () => {
    it('hard deletes prompt', async () => {
      // getActivePromptSet .where() needs chain
      mockWhere.mockReturnValueOnce(whereChain());
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);
      mockReturning.mockReturnValueOnce([{ id: 'prompt_test123' }]);

      const { deletePrompt } = await import('./prompt-set.service');
      const result = await deletePrompt('prompt_test123', 'ps_test123', 'ws_test');

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('returns null when parent set is soft-deleted', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { deletePrompt } = await import('./prompt-set.service');
      const result = await deletePrompt('prompt_test123', 'ps_deleted', 'ws_test');

      expect(result).toBeNull();
    });

    it('returns false for non-existent prompt', async () => {
      mockWhere.mockReturnValueOnce(whereChain());
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);
      mockReturning.mockReturnValueOnce([]);

      const { deletePrompt } = await import('./prompt-set.service');
      const result = await deletePrompt('prompt_nonexistent', 'ps_test123', 'ws_test');

      expect(result).toBe(false);
    });
  });

  describe('reorderPrompts', () => {
    it('reorders prompts', async () => {
      // 1st .where() → getActivePromptSet chain (needs .limit())
      // 2nd .where() → list existing prompts (terminal)
      mockWhere
        .mockReturnValueOnce(whereChain())
        .mockReturnValueOnce([{ id: 'prompt_a' }, { id: 'prompt_b' }, { id: 'prompt_c' }]);
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);

      const { reorderPrompts } = await import('./prompt-set.service');
      const result = await reorderPrompts('ps_test123', 'ws_test', [
        'prompt_c',
        'prompt_a',
        'prompt_b',
      ]);

      expect(result).toBe(true);
    });

    it('throws if prompt IDs do not match set', async () => {
      mockWhere
        .mockReturnValueOnce(whereChain())
        .mockReturnValueOnce([{ id: 'prompt_a' }, { id: 'prompt_b' }]);
      mockLimit.mockReturnValueOnce([{ id: 'ps_test123' }]);

      const { reorderPrompts } = await import('./prompt-set.service');
      await expect(
        reorderPrompts('ps_test123', 'ws_test', ['prompt_a', 'prompt_x'])
      ).rejects.toThrow('Prompt IDs do not match the prompts in this set');
    });

    it('returns null when parent set is soft-deleted', async () => {
      mockLimit.mockReturnValueOnce([]);

      const { reorderPrompts } = await import('./prompt-set.service');
      const result = await reorderPrompts('ps_deleted', 'ws_test', ['prompt_a']);

      expect(result).toBeNull();
    });
  });
});
