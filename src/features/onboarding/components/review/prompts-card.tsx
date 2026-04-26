'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PartialErrorNotice, Skeleton } from './notices';

export type PromptChoice = 'suggested' | 'starter' | 'skip';

type Props = {
  isLoading: boolean;
  noEngine: boolean;
  partialError: string | null;
  prompts: { text: string; tag: string | null }[];
  choice: PromptChoice;
  onChoiceChange: (c: PromptChoice) => void;
  starterAvailable: boolean;
  starterPromptCount: number;
  locale: string;
  revealDelay?: string;
};

export function PromptsCard({
  isLoading,
  partialError,
  prompts,
  choice,
  onChoiceChange,
  starterAvailable,
  locale,
  revealDelay,
}: Props) {
  const t = useTranslations('onboarding.review.prompts');
  return (
    <Card
      className={cn(
        'border-border/60 motion-safe:transition-opacity motion-safe:duration-200',
        revealDelay
      )}
    >
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription className="line-clamp-1">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton lines={5} testId="review-skeleton-prompts" />
        ) : partialError ? (
          <PartialErrorNotice
            href={`/${locale}/onboarding/prompt-set`}
            message={partialError}
            cta={t('skipManualCta')}
          />
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <PromptChoiceOption
                value="suggested"
                checked={choice === 'suggested'}
                onChange={onChoiceChange}
                label={t('usingSuggested', { count: prompts.length })}
                disabled={prompts.length === 0}
              />
              {starterAvailable ? (
                <PromptChoiceOption
                  value="starter"
                  checked={choice === 'starter'}
                  onChange={onChoiceChange}
                  label={t('usingStarter')}
                />
              ) : null}
              <PromptChoiceOption
                value="skip"
                checked={choice === 'skip'}
                onChange={onChoiceChange}
                label={t('skipManualCta')}
              />
            </fieldset>
            {choice === 'suggested' && prompts.length > 0 ? (
              <ol className="flex list-decimal flex-col gap-1 pl-6 text-xs">
                {prompts.slice(0, 6).map((p, idx) => (
                  <li key={idx} className="font-mono">
                    {p.text}
                  </li>
                ))}
                {prompts.length > 6 ? (
                  <li className="list-none text-muted-foreground">+{prompts.length - 6} more</li>
                ) : null}
              </ol>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PromptChoiceOption({
  value,
  checked,
  onChange,
  label,
  disabled,
}: {
  value: PromptChoice;
  checked: boolean;
  onChange: (c: PromptChoice) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded-md border p-3 text-sm',
        checked ? 'border-primary bg-primary/5' : 'border-border',
        disabled ? 'opacity-50' : 'cursor-pointer'
      )}
    >
      <input
        type="radio"
        name="prompt-choice"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      <span>{label}</span>
    </label>
  );
}
