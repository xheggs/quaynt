'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, X, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PartialErrorNotice } from './notices';

const MAX_PROMPTS = 25;
const MAX_SUMMARY_PROMPT_PREVIEW = 3;

export type PromptChoice = 'suggested' | 'starter' | 'skip';

export type PromptEntry = { text: string; tag: string | null };

type Props = {
  noEngine: boolean;
  partialError: string | null;
  prompts: PromptEntry[];
  onPromptsChange: (next: PromptEntry[]) => void;
  choice: PromptChoice;
  onChoiceChange: (c: PromptChoice) => void;
  starterAvailable: boolean;
  starterPromptCount: number;
  revealDelay?: string;
  /** Open the editor by default (used for noEngine / partial-error). */
  initiallyExpanded?: boolean;
};

export function PromptsCard({
  partialError,
  prompts,
  onPromptsChange,
  choice,
  onChoiceChange,
  starterAvailable,
  revealDelay,
  initiallyExpanded,
}: Props) {
  const t = useTranslations('onboarding.review.prompts');
  const [expanded, setExpanded] = useState(Boolean(initiallyExpanded));
  const [draft, setDraft] = useState('');

  const previewPrompts = prompts.slice(0, MAX_SUMMARY_PROMPT_PREVIEW);
  const promptOverflowCount = Math.max(0, prompts.length - previewPrompts.length);
  const limitReached = prompts.length >= MAX_PROMPTS;

  function updatePromptAt(index: number, text: string) {
    onPromptsChange(prompts.map((p, i) => (i === index ? { ...p, text } : p)));
  }

  function removePromptAt(index: number) {
    onPromptsChange(prompts.filter((_, i) => i !== index));
  }

  function addPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || limitReached) return;
    onPromptsChange([...prompts, { text: trimmed, tag: null }]);
    setDraft('');
  }

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
        {partialError ? (
          <PartialErrorNotice message={partialError} />
        ) : !expanded ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {choice === 'starter'
                    ? t('summaryStarter')
                    : choice === 'skip'
                      ? t('summarySkipped')
                      : t('summary', { count: prompts.length })}
                </p>
                {choice === 'suggested' && previewPrompts.length > 0 ? (
                  <>
                    <ul className="flex flex-col gap-0.5" aria-label={t('summaryPromptsLabel')}>
                      {previewPrompts.map((p, idx) => (
                        <li
                          key={idx}
                          className="line-clamp-1 font-mono text-xs text-muted-foreground"
                        >
                          {p.text}
                        </li>
                      ))}
                    </ul>
                    {promptOverflowCount > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t('moreSuffix', { count: promptOverflowCount })}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpanded(true)}
                aria-expanded={false}
                aria-controls="review-prompts-editor"
              >
                {t('editCta')}
                <ChevronDown className="ml-1.5 size-4" aria-hidden="true" />
              </Button>
            </div>
            <PromptChoiceFieldset
              promptCount={prompts.length}
              choice={choice}
              onChoiceChange={onChoiceChange}
              starterAvailable={starterAvailable}
              t={t}
            />
          </div>
        ) : (
          <div id="review-prompts-editor" className="flex flex-col gap-3">
            <PromptChoiceFieldset
              promptCount={prompts.length}
              choice={choice}
              onChoiceChange={onChoiceChange}
              starterAvailable={starterAvailable}
              t={t}
            />
            {choice === 'suggested' ? (
              <PromptEditor
                prompts={prompts}
                onUpdate={updatePromptAt}
                onRemove={removePromptAt}
                onAdd={addPrompt}
                draft={draft}
                onDraftChange={setDraft}
                limitReached={limitReached}
                t={t}
              />
            ) : null}
            {!initiallyExpanded ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(false)}
                  aria-expanded={true}
                  aria-controls="review-prompts-editor"
                >
                  {t('collapseCta')}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PromptEditor({
  prompts,
  onUpdate,
  onRemove,
  onAdd,
  draft,
  onDraftChange,
  limitReached,
  t,
}: {
  prompts: PromptEntry[];
  onUpdate: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  onAdd: (text: string) => void;
  draft: string;
  onDraftChange: (text: string) => void;
  limitReached: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAdd(draft);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {prompts.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('emptyState')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {prompts.map((p, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <Input
                value={p.text}
                onChange={(e) => onUpdate(idx, e.target.value)}
                aria-label={t('promptInputLabel', { position: idx + 1 })}
                maxLength={5000}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(idx)}
                aria-label={t('removePrompt')}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder={t('newPromptPlaceholder')}
          maxLength={5000}
          disabled={limitReached}
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd(draft)}
          disabled={limitReached || !draft.trim()}
        >
          <Plus className="mr-1 size-4" aria-hidden="true" />
          {t('addPrompt')}
        </Button>
      </div>
      {limitReached ? (
        <p className="text-xs text-muted-foreground">{t('limitReached', { max: MAX_PROMPTS })}</p>
      ) : null}
    </div>
  );
}

function PromptChoiceFieldset({
  promptCount,
  choice,
  onChoiceChange,
  starterAvailable,
  t,
}: {
  promptCount: number;
  choice: PromptChoice;
  onChoiceChange: (c: PromptChoice) => void;
  starterAvailable: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <PromptChoiceOption
        value="suggested"
        checked={choice === 'suggested'}
        onChange={onChoiceChange}
        label={t('usingSuggested', { count: promptCount })}
        disabled={promptCount === 0}
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
