'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PartialErrorNotice } from './notices';

const MAX_SUMMARY_CHIPS = 8;

type Competitor = { name: string; domain: string | null; reason: string | null };

type Props = {
  noEngine: boolean;
  partialError: string | null;
  competitors: Competitor[];
  selected: Set<number>;
  extras: { name: string; domain: string }[];
  onToggle: (idx: number) => void;
  onAddExtra: () => void;
  onUpdateExtra: (idx: number, patch: Partial<{ name: string; domain: string }>) => void;
  onRemoveExtra: (idx: number) => void;
  locale: string;
  revealDelay?: string;
  brandName?: string;
  /** Open the editor by default (used for noEngine / partial-error). */
  initiallyExpanded?: boolean;
  /**
   * Number of competitors selected by default after suggestions land.
   * Used to compute an "edited" count for the collapsed summary.
   */
  defaultSelectedCount: number;
};

export function CompetitorsCard({
  noEngine,
  partialError,
  competitors,
  selected,
  extras,
  onToggle,
  onAddExtra,
  onUpdateExtra,
  onRemoveExtra,
  revealDelay,
  brandName,
  initiallyExpanded,
  defaultSelectedCount,
}: Props) {
  const t = useTranslations('onboarding.review.competitors');
  const tCompetitorFields = useTranslations('onboarding.review.competitors.fields');
  const [expanded, setExpanded] = useState(Boolean(initiallyExpanded));

  const title = noEngine ? t('titleManual') : t('title');
  const description = noEngine
    ? brandName
      ? t('descriptionManual', { brand: brandName })
      : t('descriptionManualNoBrand')
    : t('description');

  const filledExtras = extras.filter((c) => c.name.trim());
  const selectedCount = selected.size + filledExtras.length;

  const selectedNames: string[] = [];
  competitors.forEach((c, idx) => {
    if (selected.has(idx)) selectedNames.push(c.name);
  });
  filledExtras.forEach((c) => selectedNames.push(c.name.trim()));

  const previewNames = selectedNames.slice(0, MAX_SUMMARY_CHIPS);
  const overflowCount = Math.max(0, selectedNames.length - previewNames.length);

  const selectionDiff = Math.abs(selected.size - defaultSelectedCount);
  const editedCount = selectionDiff + filledExtras.length;
  const showEmpty = selectedCount === 0 && competitors.length === 0;

  return (
    <Card
      className={cn(
        'border-border/60 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500',
        revealDelay
      )}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="line-clamp-1">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {partialError ? (
          <PartialErrorNotice message={partialError} />
        ) : !expanded ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {showEmpty ? (
                  <span>{t('summaryNoneSelected')}</span>
                ) : (
                  <>
                    <span className="font-medium text-foreground">
                      {t('summary', { count: selectedCount })}
                    </span>
                    {editedCount > 0 ? (
                      <span data-testid="competitors-edited-suffix">
                        {t('summaryEdited', { count: editedCount })}
                      </span>
                    ) : null}
                  </>
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpanded(true)}
                aria-expanded={false}
                aria-controls="review-competitors-editor"
              >
                {t('editCta')}
                <ChevronDown className="ml-1.5 size-4" aria-hidden="true" />
              </Button>
            </div>
            {previewNames.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {previewNames.map((name, idx) => (
                  <li key={`${name}-${idx}`}>
                    <Badge variant="secondary" className="h-6 px-2 text-xs">
                      {name}
                    </Badge>
                  </li>
                ))}
                {overflowCount > 0 ? (
                  <li>
                    <Badge variant="outline" className="h-6 px-2 text-xs">
                      {t('summaryMoreChip', { count: overflowCount })}
                    </Badge>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : (
          <div id="review-competitors-editor" className="flex flex-col gap-3">
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
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={onAddExtra}>
                {t('addAnother')}
              </Button>
              {!initiallyExpanded ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(false)}
                  aria-expanded={true}
                  aria-controls="review-competitors-editor"
                >
                  {t('collapseCta')}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
