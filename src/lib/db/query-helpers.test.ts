// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { paginationConfig, sortConfig } from './query-helpers';

vi.mock('./index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 42 }]),
      }),
    }),
  },
}));

describe('paginationConfig', () => {
  it('returns correct limit and offset for page 1', () => {
    expect(paginationConfig({ page: 1, limit: 25 })).toEqual({
      limit: 25,
      offset: 0,
    });
  });

  it('returns correct offset for page 3', () => {
    expect(paginationConfig({ page: 3, limit: 10 })).toEqual({
      limit: 10,
      offset: 20,
    });
  });

  it('returns correct offset for page 2 with limit 50', () => {
    expect(paginationConfig({ page: 2, limit: 50 })).toEqual({
      limit: 50,
      offset: 50,
    });
  });
});

describe('sortConfig', () => {
  const mockColumn = { name: 'created_at' } as never;
  const columnMap = { createdAt: mockColumn };

  it('returns undefined when no sort specified', () => {
    expect(sortConfig({ order: 'desc' }, columnMap)).toBeUndefined();
  });

  it('returns undefined for unknown sort field', () => {
    expect(sortConfig({ sort: 'unknown', order: 'desc' }, columnMap)).toBeUndefined();
  });

  it('returns an SQL expression for valid sort field', () => {
    const result = sortConfig({ sort: 'createdAt', order: 'asc' }, columnMap);
    expect(result).toBeDefined();
  });
});
