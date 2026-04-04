// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTransaction = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockInnerJoin = vi.fn();

vi.mock('@/lib/db', () => {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere, innerJoin: mockInnerJoin });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockInnerJoin.mockReturnValue({ where: mockWhere });
  mockLimit.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([{ id: 'ws_test', name: 'Test', slug: 'test' }]);
  mockTransaction.mockImplementation(
    async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        insert: mockInsert,
        select: mockSelect,
      });
    }
  );

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      transaction: mockTransaction,
    },
  };
});

vi.mock('./workspace.schema', () => ({
  workspace: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    ownerId: 'ownerId',
  },
  workspaceMember: {
    id: 'id',
    workspaceId: 'workspaceId',
    userId: 'userId',
    role: 'role',
  },
}));

vi.mock('@/lib/config/env', () => ({
  env: { QUAYNT_EDITION: 'community' },
}));

describe('workspace service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, innerJoin: mockInnerJoin });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
    mockLimit.mockReturnValue([]);
  });

  describe('getWorkspaceById', () => {
    it('returns null when workspace not found', async () => {
      const { getWorkspaceById } = await import('./workspace.service');
      const result = await getWorkspaceById('ws_nonexistent');
      expect(result).toBeNull();
    });

    it('returns workspace when found', async () => {
      const ws = { id: 'ws_1', name: 'Test', slug: 'test' };
      mockLimit.mockReturnValueOnce([ws]);

      const { getWorkspaceById } = await import('./workspace.service');
      const result = await getWorkspaceById('ws_1');
      expect(result).toEqual(ws);
    });
  });

  describe('getWorkspaceMembership', () => {
    it('returns null when not a member', async () => {
      const { getWorkspaceMembership } = await import('./workspace.service');
      const result = await getWorkspaceMembership('ws_1', 'usr_1');
      expect(result).toBeNull();
    });

    it('returns membership record when found', async () => {
      const member = { id: 'wm_1', workspaceId: 'ws_1', userId: 'usr_1', role: 'owner' };
      mockLimit.mockReturnValueOnce([member]);

      const { getWorkspaceMembership } = await import('./workspace.service');
      const result = await getWorkspaceMembership('ws_1', 'usr_1');
      expect(result).toEqual(member);
    });
  });

  describe('requireWorkspaceRole', () => {
    it('throws when user is not a member', async () => {
      const { requireWorkspaceRole } = await import('./workspace.service');
      await expect(requireWorkspaceRole('ws_1', 'usr_1', 'member')).rejects.toThrow(
        'Not a member of this workspace'
      );
    });

    it('throws when role is insufficient', async () => {
      mockLimit.mockReturnValueOnce([
        { id: 'wm_1', workspaceId: 'ws_1', userId: 'usr_1', role: 'member' },
      ]);

      const { requireWorkspaceRole } = await import('./workspace.service');
      await expect(requireWorkspaceRole('ws_1', 'usr_1', 'admin')).rejects.toThrow(
        'Insufficient role: requires admin'
      );
    });

    it('allows owner to access admin-required resources', async () => {
      mockLimit.mockReturnValueOnce([
        { id: 'wm_1', workspaceId: 'ws_1', userId: 'usr_1', role: 'owner' },
      ]);

      const { requireWorkspaceRole } = await import('./workspace.service');
      const result = await requireWorkspaceRole('ws_1', 'usr_1', 'admin');
      expect(result.role).toBe('owner');
    });

    it('allows admin to access member-required resources', async () => {
      mockLimit.mockReturnValueOnce([
        { id: 'wm_1', workspaceId: 'ws_1', userId: 'usr_1', role: 'admin' },
      ]);

      const { requireWorkspaceRole } = await import('./workspace.service');
      const result = await requireWorkspaceRole('ws_1', 'usr_1', 'member');
      expect(result.role).toBe('admin');
    });
  });

  describe('createWorkspaceForUser', () => {
    it('uses a transaction', async () => {
      const { createWorkspaceForUser } = await import('./workspace.service');
      await createWorkspaceForUser('usr_1', 'Test', 'test');
      expect(mockTransaction).toHaveBeenCalledOnce();
    });
  });

  describe('generateWorkspaceSlug', () => {
    it('generates a slug with random suffix', async () => {
      const { generateWorkspaceSlug } = await import('./workspace.service');
      const slug = generateWorkspaceSlug('My Workspace');
      expect(slug).toMatch(/^my-workspace-[a-z0-9]+$/);
    });

    it('handles special characters', async () => {
      const { generateWorkspaceSlug } = await import('./workspace.service');
      const slug = generateWorkspaceSlug("John's Workspace!");
      expect(slug).toMatch(/^john-s-workspace-[a-z0-9]+$/);
    });

    it('generates unique slugs', async () => {
      const { generateWorkspaceSlug } = await import('./workspace.service');
      const slug1 = generateWorkspaceSlug('Test');
      const slug2 = generateWorkspaceSlug('Test');
      expect(slug1).not.toBe(slug2);
    });
  });
});
