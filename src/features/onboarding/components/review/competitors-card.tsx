'use client';

import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { PartialErrorNotice, Skeleton } from './notices';

type Props = {
  isLoading: boolean;
  noEngine: boolean;
  partialError: string | null;
  competitors: { name: string; domain: string | null; reason: string | null }[];
  selected: Set<number>;
  extras: { name: string; domain: string }[];
  onToggle: (idx: number) => void;
  onAddExtra: () => void;
  onUpdateExtra: (idx: number, patch: Partial<{ name: string; domain: string }>) => void;
  onRemoveExtra: (idx: number) => void;
  locale: string;
  revealDelay?: string;
  brandName?: string;
};

export function CompetitorsCard({
  isLoading,
  noEngine,
  partialError,
  competitors,
  selected,
  extras,
  onToggle,
  onAddExtra,
  onUpdateExtra,
  onRemoveExtra,
  locale,
  revealDelay,
  brandName,
}: Props) {
  const t = useTranslations('onboarding.review.competitors');
  const tCompetitorFields = useTranslations('onboarding.review.competitors.fields');
  const title = noEngine ? t('titleManual') : t('title');
  const description = noEngine
    ? brandName
      ? t('descriptionManual', { brand: brandName })
      : t('descriptionManualNoBrand')
    : t('description');
  return (
    <Card
      className={cn(
        'border-border/60 motion-safe:transition-opacity motion-safe:duration-200',
        revealDelay
      )}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="line-clamp-1">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton lines={4} testId="review-skeleton-competitors" />
        ) : partialError ? (
          <PartialErrorNotice
            href={`/${locale}/onboarding/competitors`}
            message={partialError}
            cta={t('emptyManualCta')}
          />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {competitors.map((c, idx) => (
                <li
                  key={`${c.name}-${idx}`}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-3',
                    selected.has(idx) ? 'border-primary/60 bg-primary/5' : 'border-border'
                  )}
                >
                  <Checkbox
                    id={`competitor-${idx}`}
                    checked={selected.has(idx)}
                    onCheckedChange={() => onToggle(idx)}
                  />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`competitor-${idx}`} className="text-sm font-medium">
                      {c.name}
                      {c.domain ? (
                        <span className="ml-2 text-xs text-muted-foreground">({c.domain})</span>
                      ) : null}
                    </Label>
                    {c.reason ? (
                      <span className="text-xs text-muted-foreground">{c.reason}</span>
                    ) : null}
                  </div>
                </li>
              ))}
              {extras.map((c, idx) => (
                <li key={`extra-${idx}`} className="flex items-center gap-2 rounded-md border p-3">
                  <Input
                    aria-label={tCompetitorFields('nameLabel')}
                    placeholder={tCompetitorFields('namePlaceholder')}
                    value={c.name}
                    onChange={(e) => onUpdateExtra(idx, { name: e.target.value })}
                  />
                  <Input
                    aria-label={tCompetitorFields('domainLabel')}
                    placeholder={tCompetitorFields('domainPlaceholder')}
                    value={c.domain}
                    onChange={(e) => onUpdateExtra(idx, { domain: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveExtra(idx)}
                    aria-label={tCompetitorFields('removeLabel')}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={onAddExtra}>
              {t('addAnother')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
