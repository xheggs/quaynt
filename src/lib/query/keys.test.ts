import { describe, it, expect } from 'vitest';
import { queryKeys } from './keys';

describe('queryKeys', () => {
  it('generates correct key structure for all domains', () => {
    expect(queryKeys.brands.all).toEqual(['brands']);
    expect(queryKeys.brands.lists()).toEqual(['brands', 'list']);
    expect(queryKeys.brands.list({ page: 1, limit: 25 })).toEqual([
      'brands',
      'list',
      { page: 1, limit: 25 },
    ]);
    expect(queryKeys.brands.details()).toEqual(['brands', 'detail']);
    expect(queryKeys.brands.detail('abc-123')).toEqual(['brands', 'detail', 'abc-123']);
  });

  it('produces unique keys per domain', () => {
    expect(queryKeys.brands.all[0]).not.toEqual(queryKeys.citations.all[0]);
    expect(queryKeys.alerts.lists()[0]).toEqual('alerts');
    expect(queryKeys.workspace.detail('ws-1')).toEqual(['workspace', 'detail', 'ws-1']);
  });

  it('includes filter params in list keys', () => {
    const filters = { page: 2, limit: 50, sort: 'name', order: 'asc' };
    const key = queryKeys.visibility.list(filters);
    expect(key[2]).toEqual(filters);
  });
});
