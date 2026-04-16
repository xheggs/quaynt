import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const emptyStateVariants = cva('flex flex-col items-center text-center', {
  variants: {
    variant: {
      page: 'min-h-[40vh] justify-center gap-4 px-4',
      inline: 'gap-3 py-12',
    },
  },
  defaultVariants: {
    variant: 'inline',
  },
});

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps extends VariantProps<typeof emptyStateVariants> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  variant = 'inline',
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const iconSize = variant === 'page' ? 'size-12' : 'size-8';

  return (
    <div
      data-slot="empty-state"
      aria-live="polite"
      className={cn(emptyStateVariants({ variant }), className)}
    >
      {Icon && (
        <Icon
          className={cn(iconSize, variant === 'page' ? 'text-primary/40' : 'text-muted-foreground')}
          aria-hidden="true"
        />
      )}
      <h3 className={cn('text-foreground', variant === 'page' ? 'type-section' : 'type-label')}>
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            'text-muted-foreground',
            variant === 'page' ? 'max-w-md text-sm' : 'max-w-sm text-xs'
          )}
        >
          {description}
        </p>
      )}
      {action &&
        (action.href ? (
          <Button variant="default" size="default" asChild>
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button variant="default" size="default" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
