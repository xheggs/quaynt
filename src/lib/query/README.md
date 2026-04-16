# Query Infrastructure

Shared data-fetching patterns for all feature views.

## Query Key Factory

Use `queryKeys` for consistent, hierarchical cache keys:

```ts
import { queryKeys } from '@/lib/query';

queryKeys.brands.all; // ['brands']
queryKeys.brands.lists(); // ['brands', 'list']
queryKeys.brands.list(filters); // ['brands', 'list', { page: 1, limit: 25 }]
queryKeys.brands.details(); // ['brands', 'detail']
queryKeys.brands.detail('id'); // ['brands', 'detail', 'abc-123']
```

Available domains: `brands`, `promptSets`, `modelRuns`, `citations`, `visibility`, `benchmarks`, `opportunities`, `alerts`, `reports`, `dashboard`, `adapters`, `workspace`.

## Typed Fetch Wrapper

```ts
import { apiFetch, apiFetchPaginated, ApiError } from '@/lib/query';

// Simple fetch
const brand = await apiFetch<{ data: Brand }>('/brands/abc-123');

// Paginated fetch
const { data, meta } = await apiFetchPaginated<Brand>('/brands', { page: 1, limit: 25 });
// meta = { page: 1, limit: 25, total: 42 }

// Error handling
try {
  await apiFetch('/brands', { method: 'POST', body: { name: '' } });
} catch (e) {
  if (e instanceof ApiError) {
    console.log(e.code); // 'UNPROCESSABLE_ENTITY'
    console.log(e.status); // 422
    console.log(e.details); // [{ field: 'name', message: 'Required' }]
  }
}
```

## List Views with `usePaginatedQuery`

The standard hook for any paginated list:

```tsx
'use client';

import { usePaginatedQuery } from '@/hooks/use-paginated-query';
import { queryKeys, apiFetchPaginated } from '@/lib/query';
import { DataTable, DataTablePagination } from '@/components/data-table';
import { columns } from './columns'; // your ColumnDef[]

export function BrandsList() {
  const { data, meta, isLoading, sorting, onSortingChange, pagination, onPaginationChange } =
    usePaginatedQuery({
      queryKey: (params) => queryKeys.brands.list(params),
      queryFn: (params) => apiFetchPaginated('/brands', params),
      defaultSort: 'name',
    });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        sorting={sorting}
        onSortingChange={onSortingChange}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        pageCount={Math.ceil(meta.total / meta.limit)}
        isLoading={isLoading}
      />
      <DataTablePagination
        page={meta.page}
        limit={meta.limit}
        total={meta.total}
        onPageChange={(page) => onPaginationChange({ pageIndex: page - 1, pageSize: meta.limit })}
        onLimitChange={(limit) => onPaginationChange({ pageIndex: 0, pageSize: limit })}
      />
    </>
  );
}
```

## Form Mutations with `useApiMutation`

The standard hook for form submissions:

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { apiFetch, queryKeys } from '@/lib/query';
import { SubmitButton } from '@/components/forms';

const schema = z.object({ name: z.string().min(1) });

export function CreateBrandForm() {
  const t = useTranslations('brands');
  const form = useForm({ resolver: zodResolver(schema) });

  const { mutate, isPending } = useApiMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      apiFetch('/brands', { method: 'POST', body: data }),
    invalidateKeys: [queryKeys.brands.lists()],
    successMessage: t('created'),
    form,
  });

  return (
    <form onSubmit={form.handleSubmit((data) => mutate(data))}>
      <input {...form.register('name')} />
      {form.formState.errors.name && <span>{form.formState.errors.name.message}</span>}
      <SubmitButton isSubmitting={isPending} />
    </form>
  );
}
```

## SSR Prefetching

For server-side data prefetching in page components:

```tsx
// app/[locale]/brands/page.tsx (Server Component)
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient, queryKeys, apiFetchPaginated } from '@/lib/query';
import { BrandsList } from './brands-list';

export default async function BrandsPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.brands.list({ page: 1, limit: 25 }),
    queryFn: () => apiFetchPaginated('/brands', { page: 1, limit: 25 }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BrandsList />
    </HydrationBoundary>
  );
}
```

The `getQueryClient()` singleton ensures:

- **Server:** New `QueryClient` per request (no state leaking between users)
- **Client:** Reused singleton (stable across renders)
