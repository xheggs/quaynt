'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { uploadTemplateLogo } from '../reports.api';
import { logoUploadSchema } from '../reports.validation';

interface TemplateLogoUploadProps {
  currentLogoUrl?: string;
  onLogoUploaded: (uploadId: string) => void;
  onLogoRemoved: () => void;
}

export function TemplateLogoUpload({
  currentLogoUrl,
  onLogoUploaded,
  onLogoRemoved,
}: TemplateLogoUploadProps) {
  const t = useTranslations('reportsTemplates');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      const result = logoUploadSchema.safeParse({ file });
      if (!result.success) {
        const msg = result.error.issues[0]?.message ?? 'validation.logoInvalidType';
        toast.error(t(`validation.${msg.replace('validation.', '')}` as never));
        return;
      }

      setIsUploading(true);
      try {
        const { uploadId } = await uploadTemplateLogo(file);
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        onLogoUploaded(uploadId);
      } catch {
        toast.error(t('errors.uploadFailed'));
      } finally {
        setIsUploading(false);
      }
    },
    [onLogoUploaded, t]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    onLogoRemoved();
  }, [onLogoRemoved]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  if (isUploading) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed border-border p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <Loader2 className="size-4 animate-spin" />
          {t('form.logoUploading')}
        </div>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div className="group relative inline-block rounded-md border border-border p-2">
        <img src={previewUrl} alt="" className="max-h-[100px] max-w-[200px] object-contain" />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute -right-2 -top-2 size-6 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          onClick={handleRemove}
          aria-label={t('form.logoRemove')}
        >
          <X className="size-3" />
        </Button>
        <span className="sr-only" aria-live="polite">
          {t('form.logoUploaded')}
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed p-6 text-center transition-colors ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">{t('form.logoUpload')}</p>
        <p className="type-caption text-muted-foreground">{t('form.logoHint')}</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden="true"
      />
    </>
  );
}
