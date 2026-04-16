'use client';

import { useCallback } from 'react';
import { parseAsInteger, parseAsString, parseAsIsoDate, useQueryStates } from 'nuqs';

const tableParamsParsers = {
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(25),
  sort: parseAsString,
  order: parseAsString.withDefault('desc'),
  search: parseAsString,
  from: parseAsIsoDate,
  to: parseAsIsoDate,
};

export type TableParams = {
  page: number;
  limit: number;
  sort: string | null;
  order: string;
  search: string | null;
  from: Date | null;
  to: Date | null;
};

/**
 * URL-synced table parameters via nuqs.
 * Changing any filter (except page) resets page to 1.
 */
export function useTableParams() {
  const [params, setQueryStates] = useQueryStates(tableParamsParsers, {
    shallow: false,
  });

  const setParams = useCallback(
    (updates: Partial<Record<keyof typeof tableParamsParsers, unknown>>) => {
      const isFilterChange = Object.keys(updates).some((key) => key !== 'page');
      setQueryStates({
        ...updates,
        // Reset page to 1 when any filter changes
        ...(isFilterChange && !('page' in updates) && { page: 1 }),
      } as Parameters<typeof setQueryStates>[0]);
    },
    [setQueryStates]
  );

  const resetParams = useCallback(() => {
    setQueryStates({
      page: null,
      limit: null,
      sort: null,
      order: null,
      search: null,
      from: null,
      to: null,
    });
  }, [setQueryStates]);

  return { params, setParams, resetParams };
}
