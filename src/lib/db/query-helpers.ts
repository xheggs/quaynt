import { count, and, gte, lte, asc, desc } from 'drizzle-orm';
import type { SQL, Column } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db } from './index';

export function paginationConfig({ page, limit }: { page: number; limit: number }) {
  return {
    limit,
    offset: (page - 1) * limit,
  };
}

export function sortConfig(
  { sort, order }: { sort?: string; order: 'asc' | 'desc' },
  columnMap: Record<string, Column>
): SQL | undefined {
  if (!sort) return undefined;

  const column = columnMap[sort];
  if (!column) return undefined;

  return order === 'asc' ? asc(column) : desc(column);
}

export function applyDateRange(
  conditions: SQL[],
  { from, to }: { from?: string; to?: string },
  dateColumn: Column
): void {
  if (from) {
    conditions.push(gte(dateColumn, new Date(from)));
  }
  if (to) {
    conditions.push(lte(dateColumn, new Date(to)));
  }
}

export async function countTotal(table: PgTable, conditions: SQL[]): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(table)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result?.count ?? 0;
}
