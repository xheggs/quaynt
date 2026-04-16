'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useApiMutation } from '@/hooks/use-api-mutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { WebhookSecretRotation } from '../../integrations.types';
import { rotateWebhookSecret } from '../../integrations.api';

interface RotateSecretDialogProps {
  webhookId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RotateSecretDialog({ webhookId, open, onOpenChange }: RotateSecretDialogProps) {
  const t = useTranslations('settings');
  const [step, setStep] = useState<'confirm' | 'display'>('confirm');
  const [newSecret, setNewSecret] = useState('');
  const [copied, setCopied] = useState(false);

  const mutation = useApiMutation<WebhookSecretRotation, string>({
    mutationFn: () => rotateWebhookSecret(webhookId!),
    successMessage: t('webhooks.secret.rotateSuccess'),
    onSuccess: (data) => {
      setNewSecret(data.secret);
      setStep('display');
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setStep('confirm');
      setNewSecret('');
      setCopied(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {step === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('webhooks.secret.rotateTitle')}</DialogTitle>
              <DialogDescription>{t('webhooks.secret.rotateConfirm')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t('webhooks.form.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => mutation.mutate(webhookId!)}
                disabled={mutation.isPending}
              >
                {t('webhooks.secret.rotateButton')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('webhooks.secret.title')}</DialogTitle>
            </DialogHeader>

            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('webhooks.secret.info')}
              </p>
            </div>

            <div className="flex gap-2">
              <Input value={newSecret} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(newSecret);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
              </Button>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>{t('webhooks.secret.done')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
