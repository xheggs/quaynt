'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useUploadMutation, useUploadDetailQuery } from '../use-crawler-queries';

const ALLOWED_EXTENSIONS = ['.log', '.txt', '.gz'];

export function CrawlerUploadDialog() {
  const t = useTranslations('crawlerAnalytics');
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadMutation();
  const uploadDetail = useUploadDetailQuery(uploadId);

  const validateFile = useCallback(
    (file: File): boolean => {
      const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!hasValidExt) {
        toast.error(t('errors.invalidFileType'));
        return false;
      }
      return true;
    },
    [t]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!validateFile(file)) return;
      setSelectedFile(file);
    },
    [validateFile]
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const result = await uploadMutation.mutateAsync({ file: selectedFile });
      setUploadId(result.data.uploadId);
      toast.success(t('upload.title'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.uploadFailed');
      toast.error(message);
    }
  }, [selectedFile, uploadMutation, t]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setUploadId(null);
  }, []);

  const status = uploadDetail.data?.data?.status;
  const isProcessing = status === 'pending' || status === 'processing';
  const isComplete = status === 'completed';

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) handleReset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 size-4" />
          {t('upload.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('upload.title')}</DialogTitle>
        </DialogHeader>

        {!uploadId ? (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
            >
              <Upload className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('upload.dropzone')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('upload.formats')}</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".log,.txt,.gz"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {/* Selected file */}
            {selectedFile && (
              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                  <X className="size-4" />
                </Button>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? t('status.processing') : t('upload.title')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4 text-center">
            {isProcessing && (
              <>
                <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  {t('upload.processing', {
                    parsed: uploadDetail.data?.data?.linesParsed ?? 0,
                    total: uploadDetail.data?.data?.linesTotal ?? 0,
                  })}
                </p>
              </>
            )}
            {isComplete && (
              <>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  {t('upload.complete', {
                    visits: uploadDetail.data?.data?.linesParsed ?? 0,
                    bots: 0,
                  })}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    handleReset();
                  }}
                >
                  {t('status.completed')}
                </Button>
              </>
            )}
            {status === 'failed' && (
              <>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {t('upload.failed', {
                    error: uploadDetail.data?.data?.errorMessage ?? '',
                  })}
                </p>
                <Button variant="outline" onClick={handleReset}>
                  {t('errors.uploadFailed')}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
