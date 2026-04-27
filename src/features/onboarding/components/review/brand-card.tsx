'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AliasInput } from '@/features/brands/components/alias-input';
import { cn } from '@/lib/utils';

export type AliasSource = 'extracted' | 'ai' | 'empty';

type Props = {
  brandName: string;
  aliases: string[];
  aliasSource: AliasSource;
  onBrandNameChange: (v: string) => void;
  onAliasesChange: (v: string[]) => void;
  host: string | null;
  /** Tailwind delay class — used for the staggered reveal once data lands. */
  revealDelay?: string;
};

export function BrandCard({
  brandName,
  aliases,
  aliasSource,
  onBrandNameChange,
  onAliasesChange,
  revealDelay,
}: Props) {
  const t = useTranslations('onboarding.review.brand');
  const helperKey =
    aliasSource === 'extracted'
      ? 'aliasesHelperFromExtraction'
      : aliasSource === 'ai'
        ? 'aliasesHelperFromAi'
        : brandName.trim()
          ? 'aliasesHelperEmpty'
          : 'aliasesHelperEmptyNoBrand';
  const helperText =
    helperKey === 'aliasesHelperEmpty'
      ? t('aliasesHelperEmpty', { brand: brandName.trim() })
      : t(helperKey);
  return (
    <Card
      className={cn(
        'border-border/60 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500',
        revealDelay
      )}
    >
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription className="line-clamp-1">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="review-brand-name">{t('nameLabel')}</Label>
          <Input
            id="review-brand-name"
            value={brandName}
            onChange={(e) => onBrandNameChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t('aliasesLabel')}</Label>
          <AliasInput
            value={aliases}
            onChange={onAliasesChange}
            maxItems={10}
            helperText={helperText}
          />
        </div>
      </CardContent>
    </Card>
  );
}
