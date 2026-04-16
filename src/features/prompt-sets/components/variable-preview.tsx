'use client';

import { Badge } from '@/components/ui/badge';
import { KNOWN_VARIABLES } from '../lib/template-variables';

interface VariablePreviewProps {
  template: string;
  className?: string;
}

const SPLIT_REGEX = /(\{\{\w+\}\})/g;
const EXTRACT_NAME_REGEX = /^\{\{(\w+)\}\}$/;

export function VariablePreview({ template, className }: VariablePreviewProps) {
  const parts = template.split(SPLIT_REGEX);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const nameMatch = part.match(EXTRACT_NAME_REGEX);
        if (!nameMatch) {
          return <span key={index}>{part}</span>;
        }

        const varName = nameMatch[1];
        const isKnown = (KNOWN_VARIABLES as readonly string[]).includes(varName);

        return (
          <Badge key={index} variant={isKnown ? 'default' : 'secondary'} className="mx-0.5 text-xs">
            {part}
          </Badge>
        );
      })}
    </span>
  );
}
