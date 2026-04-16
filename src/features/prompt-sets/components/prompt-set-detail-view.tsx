'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { queryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/query/types';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { DetailSkeleton } from '@/components/skeletons/detail-skeleton';
import { TableSkeleton } from '@/components/skeletons';

import { fetchPromptSet, fetchPrompts } from '../prompt-set.api';
import { PromptSetFormDialog } from './prompt-set-form-dialog';
import { DeletePromptSetDialog } from './delete-prompt-set-dialog';
import { DeletePromptDialog } from './delete-prompt-dialog';
import { PromptList } from './prompt-list';
import { AddPromptForm } from './add-prompt-form';

interface PromptSetDetailViewProps {
  promptSetId: string;
}

export function PromptSetDetailView({ promptSetId }: PromptSetDetailViewProps) {
  return (
    <ErrorBoundary>
      <PromptSetDetailContent promptSetId={promptSetId} />
    </ErrorBoundary>
  );
}

function PromptSetDetailContent({ promptSetId }: PromptSetDetailViewProps) {
  const t = useTranslations('promptSets');
  const tUi = useTranslations('ui');
  const locale = useLocale();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);

  const {
    data: promptSet,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.promptSets.detail(promptSetId),
    queryFn: () => fetchPromptSet(promptSetId),
  });

  const { data: prompts, isLoading: promptsLoading } = useQuery({
    queryKey: [...queryKeys.promptSets.detail(promptSetId), 'prompts'],
    queryFn: () => fetchPrompts(promptSetId),
    enabled: !!promptSet,
  });

  const { showSkeleton } = useDelayedLoading(isLoading);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  });

  // 404 handling
  if (isError && error instanceof ApiError && error.status === 404) {
    return (
      <ErrorState
        variant="page"
        title={t('errors.notFound')}
        description={tUi('error.notFound.description')}
        onRetry={() => router.push(`/${locale}/prompt-sets`)}
      />
    );
  }

  if (isError) {
    return <ErrorState variant="section" onRetry={() => refetch()} />;
  }

  if (showSkeleton || !promptSet) {
    return <DetailSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label={tUi('breadcrumb.label')}>
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link
              href={`/${locale}/prompt-sets`}
              className="transition-colors hover:text-foreground"
            >
              {t('labels.promptSets')}
            </Link>
          </li>
          <li>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="font-medium text-foreground">
            {promptSet.name}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="type-page">{promptSet.name}</h1>
          {promptSet.description && (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
              {promptSet.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            {tUi('actions.edit')}
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            {tUi('actions.delete')}
          </Button>
        </div>
      </div>

      {/* Tags */}
      {promptSet.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {promptSet.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Metadata bar */}
      <div className="flex gap-6 type-caption text-muted-foreground">
        <span>{t('detail.promptCount', { count: promptSet.promptCount })}</span>
        <span className="border-l border-border pl-6">
          {t('detail.created')} {dateFormatter.format(new Date(promptSet.createdAt))}
        </span>
        <span className="border-l border-border pl-6">
          {t('detail.updated')} {dateFormatter.format(new Date(promptSet.updatedAt))}
        </span>
      </div>

      {/* Prompts section */}
      <div className="space-y-4">
        <h2 className="type-section">{t('detail.prompts')}</h2>

        {promptsLoading ? (
          <TableSkeleton columns={1} rows={3} />
        ) : (
          <>
            <PromptList
              promptSetId={promptSetId}
              prompts={prompts ?? []}
              onDeletePrompt={(id) => setDeletePromptId(id)}
            />
            <AddPromptForm promptSetId={promptSetId} />
          </>
        )}
      </div>

      {/* Dialogs */}
      <PromptSetFormDialog
        mode="edit"
        promptSet={promptSet}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeletePromptSetDialog
        promptSet={promptSet}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => router.push(`/${locale}/prompt-sets`)}
      />
      <DeletePromptDialog
        promptSetId={promptSetId}
        promptId={deletePromptId}
        open={deletePromptId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletePromptId(null);
        }}
      />
    </div>
  );
}
