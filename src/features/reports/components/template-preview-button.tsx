'use client';

import { useCallback, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { fetchTemplatePreview } from '../reports.api';

interface TemplatePreviewButtonProps {
  templateId: string;
  disabled?: boolean;
}

export function TemplatePreviewButton({ templateId, disabled }: TemplatePreviewButtonProps) {
  const t = useTranslations('reportsTemplates');
  const [isLoading, setIsLoading] = useState(false);

  const handlePreview = useCallback(async () => {
    setIsLoading(true);
    try {
      const blob = await fetchTemplatePreview(templateId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast.error(t('preview.error'));
    } finally {
      setIsLoading(false);
    }
  }, [templateId, t]);

  return (
    <Button variant="outline" size="sm" disabled={disabled || isLoading} onClick={handlePreview}>
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {t('preview.generating')}
        </>
      ) : (
        <>
          <Eye className="size-4" />
          {t('preview.button')}
        </>
      )}
    </Button>
  );
}
