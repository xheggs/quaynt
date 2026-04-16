'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CitationSnippetCardProps {
  snippet: string;
  searchTerm?: string;
}

function highlightMatches(text: string, term: string): ReactNode[] {
  if (!term) return [text];

  const parts: ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let lastIndex = 0;

  let index = lowerText.indexOf(lowerTerm, lastIndex);
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }
    parts.push(
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-900/50 rounded-sm px-0.5">
        {text.slice(index, index + term.length)}
      </mark>
    );
    lastIndex = index + term.length;
    index = lowerText.indexOf(lowerTerm, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function CitationSnippetCard({ snippet, searchTerm }: CitationSnippetCardProps) {
  const t = useTranslations('citations');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.contextSnippet')}</CardTitle>
      </CardHeader>
      <CardContent>
        <blockquote className="border-l-4 border-muted-foreground/25 pl-4 text-sm leading-relaxed text-foreground/90">
          {searchTerm ? highlightMatches(snippet, searchTerm) : snippet}
        </blockquote>
      </CardContent>
    </Card>
  );
}
