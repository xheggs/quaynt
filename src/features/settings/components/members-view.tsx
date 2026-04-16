'use client';

import { useCallback, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { authClient } from '@/modules/auth/auth.client';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FilterBar } from '@/components/filters/filter-bar';
import { SearchFilter } from '@/components/filters/search-filter';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { TableSkeleton } from '@/components/skeletons';

import type { WorkspaceMember } from '../settings.types';
import { useMembersQuery, useWorkspaceQuery } from '../use-settings-query';
import { useMemberColumns } from './member-columns';
import { AddMemberDialog } from './add-member-dialog';
import { ChangeRoleDialog } from './change-role-dialog';
import { RemoveMemberDialog } from './remove-member-dialog';

export function MembersView() {
  return (
    <ErrorBoundary>
      <MembersContent />
    </ErrorBoundary>
  );
}

function MembersContent() {
  const t = useTranslations('settings');
  const session = authClient.useSession();
  const workspaceQuery = useWorkspaceQuery();

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [changeRoleMember, setChangeRoleMember] = useState<WorkspaceMember | null>(null);
  const [removeMember, setRemoveMember] = useState<WorkspaceMember | null>(null);

  const {
    data,
    meta,
    isLoading,
    isError,
    params,
    setParams,
    resetParams,
    sorting,
    onSortingChange,
    pagination,
    onPaginationChange,
  } = useMembersQuery();

  const { showSkeleton } = useDelayedLoading(isLoading);

  const currentUserId = session.data?.user?.id ?? '';
  const isAdmin = session.data?.user?.id === workspaceQuery.data?.ownerId;

  const onChangeRole = useCallback((member: WorkspaceMember) => setChangeRoleMember(member), []);
  const onRemove = useCallback((member: WorkspaceMember) => setRemoveMember(member), []);
  const columns = useMemberColumns({ onChangeRole, onRemove, currentUserId, isAdmin });

  const hasSearch = !!params.search;
  const isEmpty = meta.total === 0 && !hasSearch && !isLoading;

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState variant="section" onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="type-section">{t('members.title')}</h1>
          {meta.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {t('members.count', { count: meta.total })}
            </span>
          )}
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" />
            {t('members.add')}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{t('members.description')}</p>

      {isEmpty ? (
        <EmptyState
          variant="page"
          icon={Users}
          title={t('members.empty.title')}
          description={t('members.empty.description')}
        />
      ) : (
        <>
          {/* Filter bar */}
          <FilterBar activeCount={hasSearch ? 1 : 0} onClearAll={resetParams}>
            <SearchFilter
              value={params.search ?? ''}
              onChange={(search) => setParams({ search: search || null })}
              placeholder={t('members.search')}
            />
          </FilterBar>

          {/* Table */}
          {showSkeleton ? (
            <div className="rounded-md border border-border">
              <TableSkeleton columns={4} rows={10} />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data}
              pageCount={Math.ceil(meta.total / meta.limit)}
              pagination={pagination}
              onPaginationChange={onPaginationChange}
              sorting={sorting}
              onSortingChange={onSortingChange}
            />
          )}

          {/* Pagination */}
          {meta.total > 0 && (
            <DataTablePagination
              page={meta.page}
              limit={meta.limit}
              total={meta.total}
              onPageChange={(page) => setParams({ page })}
              onLimitChange={(limit) => setParams({ limit })}
            />
          )}
        </>
      )}

      {/* Dialogs */}
      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />
      <ChangeRoleDialog
        member={changeRoleMember}
        open={!!changeRoleMember}
        onOpenChange={(open) => {
          if (!open) setChangeRoleMember(null);
        }}
      />
      <RemoveMemberDialog
        member={removeMember}
        open={!!removeMember}
        onOpenChange={(open) => {
          if (!open) setRemoveMember(null);
        }}
      />
    </div>
  );
}
