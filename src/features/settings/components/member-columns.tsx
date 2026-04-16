'use client';

import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Shield, UserMinus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  DataTableRowActions,
  type RowAction,
} from '@/components/data-table/data-table-row-actions';
import { Badge } from '@/components/ui/badge';

import type { WorkspaceMember } from '../settings.types';

interface UseMemberColumnsCallbacks {
  onChangeRole: (member: WorkspaceMember) => void;
  onRemove: (member: WorkspaceMember) => void;
  currentUserId: string;
  isAdmin: boolean;
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
};

export function useMemberColumns({
  onChangeRole,
  onRemove,
  currentUserId,
  isAdmin,
}: UseMemberColumnsCallbacks): ColumnDef<WorkspaceMember>[] {
  const t = useTranslations('settings');
  const locale = useLocale();

  return useMemo(
    (): ColumnDef<WorkspaceMember>[] => [
      {
        id: 'name',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('members.columns.name')}
          </span>
        ),
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div>
              <p className="font-medium text-foreground">{member.userName}</p>
              <p className="text-xs text-muted-foreground">{member.userEmail}</p>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        id: 'role',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('members.columns.role')}
          </span>
        ),
        cell: ({ row }) => {
          const role = row.original.role;
          return (
            <Badge variant={ROLE_VARIANT[role] ?? 'outline'}>
              {t(`members.roleLabels.${role}` as never)}
            </Badge>
          );
        },
        enableSorting: false,
      },
      {
        id: 'joined',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            {t('members.columns.joined')}
          </span>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.joinedAt);
          return (
            <span className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }).format(date)}
            </span>
          );
        },
        enableSorting: true,
      },
      ...(isAdmin
        ? [
            {
              id: 'actions',
              header: () => <span className="sr-only">{t('members.columns.actions')}</span>,
              cell: ({ row }: { row: { original: WorkspaceMember } }) => {
                const member = row.original;
                const isSelf = member.userId === currentUserId;

                if (isSelf) return null;

                const actions: RowAction[] = [
                  {
                    label: t('members.changeRoleTitle'),
                    icon: Shield,
                    onClick: () => onChangeRole(member),
                  },
                  {
                    label: t('members.removeTitle'),
                    icon: UserMinus,
                    onClick: () => onRemove(member),
                    variant: 'destructive',
                  },
                ];

                return <DataTableRowActions actions={actions} />;
              },
              enableSorting: false,
            } satisfies ColumnDef<WorkspaceMember>,
          ]
        : []),
    ],
    [t, locale, onChangeRole, onRemove, currentUserId, isAdmin]
  );
}
