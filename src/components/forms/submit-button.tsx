'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button, type buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';

interface SubmitButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  isSubmitting?: boolean;
}

export function SubmitButton({ isSubmitting = false, children, ...props }: SubmitButtonProps) {
  const t = useTranslations('ui');

  return (
    <Button type="submit" disabled={isSubmitting} {...props}>
      {isSubmitting ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          {t('form.saving')}
        </>
      ) : (
        (children ?? t('form.submit'))
      )}
    </Button>
  );
}
