import * as React from 'react';

import { cn } from '@/lib/utils';

type TypographyVariant =
  | 'display'
  | 'kpi'
  | 'page'
  | 'section'
  | 'card-title'
  | 'body'
  | 'table'
  | 'label'
  | 'overline'
  | 'caption';

const variantClasses: Record<TypographyVariant, string> = {
  display: 'type-display',
  kpi: 'type-kpi',
  page: 'type-page',
  section: 'type-section',
  'card-title': 'type-card-title',
  body: 'type-body',
  table: 'type-table',
  label: 'type-label',
  overline: 'type-overline',
  caption: 'type-caption',
};

const defaultElements: Record<TypographyVariant, keyof React.JSX.IntrinsicElements> = {
  display: 'h1',
  kpi: 'span',
  page: 'h1',
  section: 'h2',
  'card-title': 'h3',
  body: 'p',
  table: 'span',
  label: 'span',
  overline: 'span',
  caption: 'span',
};

interface TypographyProps {
  variant: TypographyVariant;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
}

function Typography({
  variant,
  as,
  className,
  children,
  ...props
}: TypographyProps & Omit<React.ComponentPropsWithoutRef<'div'>, keyof TypographyProps>) {
  const Component = (as ?? defaultElements[variant]) as React.ElementType;

  return (
    <Component className={cn(variantClasses[variant], className)} {...props}>
      {children}
    </Component>
  );
}

/* Convenience wrappers */

type HeadingVariant = 'page' | 'section' | 'card-title';

function Heading({
  variant = 'page',
  ...props
}: Omit<TypographyProps, 'variant'> & { variant?: HeadingVariant }) {
  return <Typography variant={variant} {...props} />;
}

type TextVariant = 'body' | 'label' | 'caption' | 'overline';

function Text({
  variant = 'body',
  ...props
}: Omit<TypographyProps, 'variant'> & { variant?: TextVariant }) {
  return <Typography variant={variant} {...props} />;
}

function KpiValue({ className, ...props }: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="kpi" className={cn('text-foreground', className)} {...props} />;
}

export { Typography, Heading, Text, KpiValue };
export type { TypographyVariant, HeadingVariant, TextVariant };
