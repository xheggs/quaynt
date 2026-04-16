'use client';

import { useCallback, useRef, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import type { Prompt } from '../prompt-set.types';
import { updatePrompt } from '../prompt-set.api';
import { VariablePreview } from './variable-preview';

interface PromptEditorProps {
  prompt: Prompt;
  promptSetId: string;
  onDelete: (promptId: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

export function PromptEditor({
  prompt,
  promptSetId,
  onDelete,
  dragHandleProps,
}: PromptEditorProps) {
  const t = useTranslations('promptSets');
  const tUi = useTranslations('ui');

  const [isEditing, setIsEditing] = useState(false);
  const [template, setTemplate] = useState(prompt.template);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useApiMutation<Prompt, { template: string }>({
    mutationFn: (data) => updatePrompt(promptSetId, prompt.id, data),
    invalidateKeys: [queryKeys.promptSets.detail(promptSetId)],
    successMessage: t('prompts.edit.success'),
    onSuccess: () => setIsEditing(false),
  });

  const handleSave = useCallback(() => {
    const trimmed = template.trim();
    if (!trimmed || trimmed === prompt.template) {
      setIsEditing(false);
      return;
    }
    mutation.mutate({ template: trimmed });
  }, [template, prompt.template, mutation]);

  const handleCancel = useCallback(() => {
    setTemplate(prompt.template);
    setIsEditing(false);
  }, [prompt.template]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleCancel, handleSave]
  );

  const enterEditMode = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  return (
    <Card className="p-4">
      {/* Header row */}
      <div className="mb-3 flex items-center gap-2">
        {dragHandleProps && (
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            aria-label={t('dnd.pickedUp', { position: prompt.order + 1 })}
            {...dragHandleProps}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <Badge variant="outline" className="text-xs">
          #{prompt.order + 1}
        </Badge>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(prompt.id)}
          aria-label={tUi('actions.delete')}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Template area */}
      {isEditing ? (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Captures Escape key to cancel editing
        <div className="space-y-3" onKeyDown={handleKeyDown}>
          <Textarea
            ref={textareaRef}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={3}
            disabled={mutation.isPending}
            aria-label={t('fields.template')}
          />
          <div className="type-caption text-muted-foreground">
            <VariablePreview template={template} />
          </div>
          <div className="flex items-center justify-between">
            <span className="type-caption text-muted-foreground">
              {t('form.charCount', {
                current: template.length,
                max: 5000,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={mutation.isPending}
              >
                {tUi('form.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={mutation.isPending || !template.trim() || template.length > 5000}
              >
                {tUi('form.submit')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="w-full cursor-pointer text-left text-sm"
          onClick={enterEditMode}
          aria-label={t('fields.template')}
        >
          <VariablePreview template={prompt.template} />
        </button>
      )}
    </Card>
  );
}
