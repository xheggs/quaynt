'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const errorStateVariants = cva('flex flex-col items-center text-center', {
  variants: {
    variant: {
      page: 'min-h-[50vh] justify-center gap-4 px-4',
      section: 'gap-3 rounded-lg border border-border bg-card p-8',
      inline: 'flex-row gap-2 text-sm',
    },
  },
  defaultVariants: {
    variant: 'section',
  },
});

interface ErrorStateProps extends VariantProps<typeof errorStateVariants> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  icon?: LucideIcon;
  className?: string;
}

export function ErrorState({
  variant = 'section',
  title,
  description,
  onRetry,
  icon: Icon = AlertCircle,
  className,
}: ErrorStateProps) {
  const t = useTranslations('ui');

  const resolvedTitle = title ?? t('error.title');
  const resolvedDescription = description ?? t('error.description');

  if (variant === 'inline') {
    return (
      <div
        data-slot="error-state"
        role="alert"
        className={cn(errorStateVariants({ variant }), className)}
      >
        <Icon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        <span className="text-muted-foreground">{resolvedTitle}</span>
        {onRetry && (
          <button onClick={onRetry} className="text-primary underline-offset-4 hover:underline">
            {t('error.retry')}
          </button>
        )}
      </div>
    );
  }

  const iconSize = variant === 'page' ? 'size-12' : 'size-8';
  const titleSize = variant === 'page' ? 'text-base font-semibold' : 'text-sm font-semibold';
  const descSize = variant === 'page' ? 'text-sm' : 'text-xs';

  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(errorStateVariants({ variant }), className)}
    >
      <Icon className={cn(iconSize, 'text-muted-foreground')} aria-hidden="true" />
      <h2 className={cn(titleSize, 'text-foreground')}>{resolvedTitle}</h2>
      <p className={cn(descSize, 'max-w-sm text-muted-foreground')}>{resolvedDescription}</p>
      {onRetry && (
        <Button variant="default" size="default" onClick={onRetry}>
          {t('error.retry')}
        </Button>
      )}
    </div>
  );
}
