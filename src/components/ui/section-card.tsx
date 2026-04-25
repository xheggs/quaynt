import type { ReactNode } from 'react';

import { Card, CardAction, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Opinionated wrapper around `Card` for the dashboard's content grid.
 * Adds the `01 / TITLE` mono index header, optional description and
 * action slot, plus an optional footer.
 *
 * All copy must be passed in as already-translated strings — this
 * component is i18n-agnostic by design.
 */
export type SectionCardProps = {
  /** Two-character zero-padded index, e.g. `"01"`, `"02"`. */
  index: string;
  /** Section title — already translated. */
  title: string;
  /** Optional subtitle/description below the title. */
  description?: string;
  /** Right-aligned slot in the header (e.g. a button or chip). */
  action?: ReactNode;
  /** Optional footer (e.g. a "View all →" link). */
  footer?: ReactNode;
  /** A11y label for the section ("Section 01" etc.). Required. */
  indexLabel: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

export function SectionCard({
  index,
  title,
  description,
  action,
  footer,
  indexLabel,
  className,
  contentClassName,
  children,
}: SectionCardProps) {
  return (
    <Card
      data-section-card=""
      data-section-index={index}
      aria-label={indexLabel}
      className={className}
    >
      <CardHeader>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono type-overline text-muted-foreground">{index} /</span>
            <span className="type-overline text-foreground">{title}</span>
          </div>
          {description && <p className="type-caption text-muted-foreground">{description}</p>}
        </div>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
      {footer && <CardFooter className="border-t pt-3">{footer}</CardFooter>}
    </Card>
  );
}
