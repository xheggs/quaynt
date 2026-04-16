// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn();

vi.mock('@/lib/db', () => {
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning });
  mockLimit.mockReturnValue([]);
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
  mockOnConflictDoNothing.mockReturnValue({ returning: mockReturning });
  mockReturning.mockReturnValue([]);
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

vi.mock('./user-preference.schema', () => ({
  userPreference: {
    id: 'id',
    userId: 'userId',
    locale: 'locale',
  },
}));

describe('user-preference service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning });
    mockLimit.mockReturnValue([]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
    mockOnConflictDoNothing.mockReturnValue({ returning: mockReturning });
    mockReturning.mockReturnValue([]);
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe('getOrCreateUserPreference', () => {
    it('returns existing preference when found', async () => {
      const existing = { id: 'upref_1', userId: 'usr_1', locale: 'en' };
      mockLimit.mockReturnValueOnce([existing]);

      const { getOrCreateUserPreference } = await import('./user-preference.service');
      const result = await getOrCreateUserPreference('usr_1');
      expect(result).toEqual(existing);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('creates preference when not found', async () => {
      const created = { id: 'upref_2', userId: 'usr_1', locale: null };
      mockLimit.mockReturnValueOnce([]);
      mockReturning.mockReturnValueOnce([created]);

      const { getOrCreateUserPreference } = await import('./user-preference.service');
      const result = await getOrCreateUserPreference('usr_1');
      expect(result).toEqual(created);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('handles concurrent insert (conflict)', async () => {
      const fetched = { id: 'upref_3', userId: 'usr_1', locale: null };
      mockLimit
        .mockReturnValueOnce([]) // first select: not found
        .mockReturnValueOnce([fetched]); // second select after conflict
      mockReturning.mockReturnValueOnce([]); // insert returned nothing (conflict)

      const { getOrCreateUserPreference } = await import('./user-preference.service');
      const result = await getOrCreateUserPreference('usr_1');
      expect(result).toEqual(fetched);
    });
  });

  describe('updateUserPreference', () => {
    it('updates locale when provided', async () => {
      const existing = { id: 'upref_1', userId: 'usr_1', locale: null };
      const updated = { id: 'upref_1', userId: 'usr_1', locale: 'en' };
      mockLimit.mockReturnValueOnce([existing]); // getOrCreate select
      mockReturning.mockReturnValueOnce([updated]); // update returning

      const { updateUserPreference } = await import('./user-preference.service');
      const result = await updateUserPreference('usr_1', { locale: 'en' });
      expect(result).toEqual(updated);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns existing preference when no updates provided', async () => {
      const existing = { id: 'upref_1', userId: 'usr_1', locale: 'en' };
      mockLimit.mockReturnValueOnce([existing]);

      const { updateUserPreference } = await import('./user-preference.service');
      const result = await updateUserPreference('usr_1', {});
      expect(result).toEqual(existing);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
