'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { PaginationState, SortingState, OnChangeFn } from '@tanstack/react-table';

import type { PaginatedResponse, QueryFilters } from '@/lib/query/types';
import { useTableParams } from './use-table-params';

interface UsePaginatedQueryOptions<TData> {
  queryKey: (params: QueryFilters) => readonly unknown[];
  queryFn: (params: QueryFilters) => Promise<PaginatedResponse<TData>>;
  defaultSort?: string;
  defaultLimit?: number;
  refetchInterval?: number | false | ((query: unknown) => number | false);
}

/**
 * Connects TanStack Query with table state and URL params.
 * Returns props shaped for direct pass-through to DataTable + DataTablePagination.
 */
export function usePaginatedQuery<TData>({
  queryKey,
  queryFn,
  defaultSort,
  defaultLimit = 25,
  refetchInterval,
}: UsePaginatedQueryOptions<TData>) {
  const { params, setParams, resetParams } = useTableParams();

  // Build query filters from URL params
  const filters: QueryFilters = useMemo(
    () => ({
      page: params.page,
      limit: params.limit ?? defaultLimit,
      sort: params.sort ?? defaultSort,
      order: params.order as 'asc' | 'desc',
      search: params.search ?? undefined,
      from: params.from?.toISOString(),
      to: params.to?.toISOString(),
    }),
    [params, defaultSort, defaultLimit]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKey(filters),
    queryFn: () => queryFn(filters),
    placeholderData: keepPreviousData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refetchInterval: refetchInterval as any,
  });

  // TanStack Table pagination state (0-indexed pageIndex)
  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: (params.page ?? 1) - 1,
      pageSize: params.limit ?? defaultLimit,
    }),
    [params.page, params.limit, defaultLimit]
  );

  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      setParams({
        page: next.pageIndex + 1,
        limit: next.pageSize,
      });
    },
    [pagination, setParams]
  );

  // TanStack Table sorting state
  const sorting: SortingState = useMemo(() => {
    if (!params.sort) return [];
    return [{ id: params.sort, desc: params.order === 'desc' }];
  }, [params.sort, params.order]);

  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      if (next.length === 0) {
        setParams({ sort: null, order: 'desc' });
      } else {
        setParams({ sort: next[0].id, order: next[0].desc ? 'desc' : 'asc' });
      }
    },
    [sorting, setParams]
  );

  return {
    data: data?.data ?? [],
    meta: data?.meta ?? { page: 1, limit: defaultLimit, total: 0 },
    isLoading,
    isError,
    error,
    params,
    setParams,
    resetParams,
    // Direct pass-through props for DataTable
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
  };
}
