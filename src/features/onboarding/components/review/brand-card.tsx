'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Skeleton } from './notices';

type Props = {
  isLoading: boolean;
  brandName: string;
  aliasesText: string;
  onBrandNameChange: (v: string) => void;
  onAliasesChange: (v: string) => void;
  host: string | null;
  /** Tailwind delay class — used for the staggered reveal once data lands. */
  revealDelay?: string;
};

export function BrandCard({
  isLoading,
  brandName,
  aliasesText,
  onBrandNameChange,
  onAliasesChange,
  revealDelay,
}: Props) {
  const t = useTranslations('onboarding.review.brand');
  return (
    <Card
      className={cn(
        'border-border/60 motion-safe:transition-opacity motion-safe:duration-200',
        isLoading ? 'opacity-100' : 'opacity-100',
        revealDelay
      )}
    >
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription className="line-clamp-1">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton lines={2} testId="review-skeleton-brand" />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="review-brand-name">{t('nameLabel')}</Label>
              <Input
                id="review-brand-name"
                value={brandName}
                onChange={(e) => onBrandNameChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="review-brand-aliases">{t('aliasesLabel')}</Label>
              <Input
                id="review-brand-aliases"
                value={aliasesText}
                onChange={(e) => onAliasesChange(e.target.value)}
                placeholder={t('aliasesPlaceholder')}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
