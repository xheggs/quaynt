'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Info } from 'lucide-react';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { authClient } from '@/modules/auth/auth.client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/forms/submit-button';
import { ErrorState } from '@/components/error-state';
import { WorkspaceSkeleton } from './settings-skeleton';

import { updateWorkspace } from '../settings.api';
import { useWorkspaceQuery } from '../use-settings-query';
import { workspaceUpdateSchema, type WorkspaceFormValues } from '../settings.validation';

export function WorkspaceSettingsView() {
  const t = useTranslations('settings');
  const workspaceQuery = useWorkspaceQuery();
  const session = authClient.useSession();
  const { showSkeleton } = useDelayedLoading(workspaceQuery.isLoading);

  if (showSkeleton) {
    return <WorkspaceSkeleton />;
  }

  if (workspaceQuery.isError) {
    return <ErrorState variant="section" onRetry={() => workspaceQuery.refetch()} />;
  }

  const workspace = workspaceQuery.data;
  if (!workspace) return null;

  // Community edition: determine role from session user being owner
  const isAdmin = session.data?.user?.id === workspace.ownerId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-section">{t('workspace.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('workspace.description')}</p>
      </div>

      <WorkspaceForm
        workspaceName={workspace.name}
        workspaceSlug={workspace.slug}
        isAdmin={isAdmin}
      />
    </div>
  );
}

interface WorkspaceFormProps {
  workspaceName: string;
  workspaceSlug: string;
  isAdmin: boolean;
}

function WorkspaceForm({ workspaceName, workspaceSlug, isAdmin }: WorkspaceFormProps) {
  const t = useTranslations('settings');

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceUpdateSchema),
    defaultValues: {
      name: workspaceName,
    },
  });

  const mutation = useApiMutation<unknown, WorkspaceFormValues>({
    mutationFn: (data) => updateWorkspace(data),
    invalidateKeys: [queryKeys.workspace.all],
    successMessage: t('workspace.saved'),
    form,
  });

  const onSubmit = (data: WorkspaceFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('workspace.title')}</CardTitle>
        <CardDescription>{t('workspace.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!isAdmin && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" />
            {t('workspace.readOnly')}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">{t('workspace.nameLabel')}</Label>
            <Input
              id="workspace-name"
              placeholder={t('workspace.namePlaceholder')}
              disabled={!isAdmin}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {t(form.formState.errors.name.message as never)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-slug">{t('workspace.slugLabel')}</Label>
            <Input id="workspace-slug" value={workspaceSlug} disabled readOnly />
            <p className="text-xs text-muted-foreground">{t('workspace.slugHelp')}</p>
          </div>

          {isAdmin && (
            <SubmitButton isSubmitting={mutation.isPending}>{t('workspace.save')}</SubmitButton>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
