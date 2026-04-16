'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { ModelRunResult } from '../model-run.types';

interface ResultDetailProps {
  result: ModelRunResult;
}

export function ResultDetail({ result }: ResultDetailProps) {
  const t = useTranslations('modelRuns');
  const [metadataOpen, setMetadataOpen] = useState(false);

  return (
    <div className="space-y-3 p-4">
      {/* Full prompt */}
      <div className="space-y-1">
        <h4 className="text-xs font-medium text-muted-foreground">{t('results.prompt')}</h4>
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-sm">
          {result.interpolatedPrompt}
        </pre>
      </div>

      {/* Response text */}
      {result.textContent && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">{t('results.response')}</h4>
          <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">
            {result.textContent}
          </div>
        </div>
      )}

      {/* Error */}
      {result.error && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-destructive">{t('results.error')}</h4>
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {result.error}
          </div>
        </div>
      )}

      {/* Metadata (collapsible) */}
      {result.responseMetadata && Object.keys(result.responseMetadata).length > 0 && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMetadataOpen(!metadataOpen)}
          >
            <ChevronDown
              className={cn('size-3 transition-transform', metadataOpen && 'rotate-180')}
            />
            {t('results.metadata')}
          </button>
          {metadataOpen && (
            <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {JSON.stringify(result.responseMetadata, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
