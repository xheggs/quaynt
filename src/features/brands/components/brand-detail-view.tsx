'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ChevronRight, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { queryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/query/types';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ErrorBoundary } from '@/components/error-boundary';
import { DetailSkeleton } from '@/components/skeletons/detail-skeleton';

import { fetchBrand } from '../brand.api';
import { BrandFormDialog } from './brand-form-dialog';
import { DeleteBrandDialog } from './delete-brand-dialog';

interface BrandDetailViewProps {
  brandId: string;
}

export function BrandDetailView({ brandId }: BrandDetailViewProps) {
  return (
    <ErrorBoundary>
      <BrandDetailContent brandId={brandId} />
    </ErrorBoundary>
  );
}

function BrandDetailContent({ brandId }: BrandDetailViewProps) {
  const t = useTranslations('brands');
  const tUi = useTranslations('ui');
  const locale = useLocale();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: brand,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.brands.detail(brandId),
    queryFn: () => fetchBrand(brandId),
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
        onRetry={() => router.push(`/${locale}/brands`)}
      />
    );
  }

  if (isError) {
    return <ErrorState variant="section" onRetry={() => refetch()} />;
  }

  if (showSkeleton || !brand) {
    return <DetailSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label={tUi('breadcrumb.label')}>
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href={`/${locale}/brands`} className="hover:text-foreground transition-colors">
              {t('labels.brands')}
            </Link>
          </li>
          <li>
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="text-foreground font-medium">
            {brand.name}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="type-page">{brand.name}</h1>
          {brand.domain && (
            <a
              href={`https://${brand.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {brand.domain}
              <ExternalLink className="size-3" />
            </a>
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

      {/* Brand info card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('detail.info')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Aliases */}
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium">{t('detail.aliases')}</h2>
            {brand.aliases.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {brand.aliases.map((alias) => (
                  <Badge key={alias} variant="secondary">
                    {alias}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('detail.noAliases')}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium">{t('fields.description')}</h2>
            {brand.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {brand.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('detail.noDescription')}</p>
            )}
          </div>

          {/* Metadata footer */}
          <div className="flex gap-6 border-t border-border pt-4">
            <div>
              <span className="type-caption text-muted-foreground">{t('detail.created')}</span>
              <p className="type-caption text-muted-foreground">
                {dateFormatter.format(new Date(brand.createdAt))}
              </p>
            </div>
            <div>
              <span className="type-caption text-muted-foreground">{t('detail.updated')}</span>
              <p className="type-caption text-muted-foreground">
                {dateFormatter.format(new Date(brand.updatedAt))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visibility placeholder */}
      <EmptyState
        variant="inline"
        icon={BarChart3}
        title={t('detail.visibilityComingSoon')}
        description={t('detail.visibilityComingSoonDescription')}
      />

      {/* Dialogs */}
      <BrandFormDialog mode="edit" brand={brand} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteBrandDialog
        brand={brand}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => router.push(`/${locale}/brands`)}
      />
    </div>
  );
}
