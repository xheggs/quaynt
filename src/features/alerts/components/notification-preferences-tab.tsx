'use client';

import { useForm, useWatch, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';

import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SubmitButton } from '@/components/forms/submit-button';
import { ErrorState } from '@/components/error-state';
import { TableSkeleton } from '@/components/skeletons';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';

import type {
  EmailPreferenceUpdate,
  WebhookPreferenceUpdate,
  AlertSeverity,
  NotificationPreferencesResponse,
} from '../alerts.types';
import { ALERT_SEVERITIES, DIGEST_FREQUENCIES } from '../alerts.types';
import { updateNotificationPreferences } from '../alerts.api';
import { useNotificationPreferencesQuery } from '../use-alerts-query';

interface PreferencesFormValues {
  email: {
    enabled: boolean;
    digestFrequency: string;
    digestHour: number;
    digestDay: number;
    digestTimezone: string;
    severityFilter: AlertSeverity[];
  };
  webhook: {
    enabled: boolean;
    severityFilter: AlertSeverity[];
  };
}

const SEVERITY_I18N: Record<string, string> = {
  info: 'info',
  warning: 'warning',
  critical: 'critical',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number): string {
  const date = new Date(2000, 0, 1, hour);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function NotificationPreferencesTab() {
  const { data, isLoading, isError, refetch } = useNotificationPreferencesQuery();
  const { showSkeleton } = useDelayedLoading(isLoading);

  if (isError) {
    return (
      <div className="py-12">
        <ErrorState variant="section" onRetry={refetch} />
      </div>
    );
  }

  if (showSkeleton || !data) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-border p-6">
          <TableSkeleton columns={1} rows={4} />
        </div>
      </div>
    );
  }

  return <PreferencesForm data={data} />;
}

function PreferencesForm({ data }: { data: NotificationPreferencesResponse }) {
  const t = useTranslations('alerts');

  const form = useForm<PreferencesFormValues>({
    defaultValues: {
      email: {
        enabled: data.email?.enabled ?? true,
        digestFrequency: data.email?.digestFrequency ?? 'immediate',
        digestHour: data.email?.digestHour ?? 9,
        digestDay: data.email?.digestDay ?? 1,
        digestTimezone: data.email?.digestTimezone ?? 'UTC',
        severityFilter: data.email?.severityFilter ?? ['info', 'warning', 'critical'],
      },
      webhook: {
        enabled: data.webhook?.enabled ?? true,
        severityFilter: data.webhook?.severityFilter ?? ['info', 'warning', 'critical'],
      },
    },
  });

  const saveMutation = useApiMutation<
    NotificationPreferencesResponse,
    { email?: EmailPreferenceUpdate; webhook?: WebhookPreferenceUpdate }
  >({
    mutationFn: (input) => updateNotificationPreferences(input),
    invalidateKeys: [queryKeys.notificationPreferences.all],
    successMessage: t('notificationPrefs.saved'),
  });

  function onSubmit(values: PreferencesFormValues) {
    saveMutation.mutate({
      email: {
        enabled: values.email.enabled,
        digestFrequency: values.email.digestFrequency as EmailPreferenceUpdate['digestFrequency'],
        digestHour: values.email.digestHour,
        digestDay: values.email.digestDay,
        digestTimezone: values.email.digestTimezone,
        severityFilter: values.email.severityFilter,
      },
      webhook: {
        enabled: values.webhook.enabled,
        severityFilter: values.webhook.severityFilter,
      },
    });
  }

  const emailEnabled = useWatch({ control: form.control, name: 'email.enabled' });
  const digestFrequency = useWatch({ control: form.control, name: 'email.digestFrequency' });
  const webhookEnabled = useWatch({ control: form.control, name: 'webhook.enabled' });

  const showTimingFields = digestFrequency === 'daily' || digestFrequency === 'weekly';
  const showTimezone = digestFrequency !== 'immediate';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h2 className="type-section">{t('notificationPrefs.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('notificationPrefs.description')}</p>

      {/* Email Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('notificationPrefs.email.title')}</CardTitle>
            <Controller
              control={form.control}
              name="email.enabled"
              render={({ field }) => (
                <Switch id="email-enabled" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        </CardHeader>
        {emailEnabled && (
          <CardContent className="space-y-4">
            {/* Digest frequency */}
            <div className="space-y-1.5">
              <Label>{t('notificationPrefs.email.frequency')}</Label>
              <Controller
                control={form.control}
                name="email.digestFrequency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIGEST_FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {t(`notificationPrefs.email.frequencyOptions.${f}` as never)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Delivery hour */}
            {showTimingFields && (
              <div className="space-y-1.5">
                <Label>{t('notificationPrefs.email.hour')}</Label>
                <Controller
                  control={form.control}
                  name="email.digestHour"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {formatHour(h)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Delivery day */}
            {digestFrequency === 'weekly' && (
              <div className="space-y-1.5">
                <Label>{t('notificationPrefs.email.day')}</Label>
                <Controller
                  control={form.control}
                  name="email.digestDay"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {t(`notificationPrefs.email.dayOptions.${d}` as never)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Timezone */}
            {showTimezone && (
              <div className="space-y-1.5">
                <Label htmlFor="email-timezone">{t('notificationPrefs.email.timezone')}</Label>
                <Input
                  id="email-timezone"
                  {...form.register('email.digestTimezone')}
                  className="w-48"
                />
              </div>
            )}

            {/* Severity filter */}
            <div className="space-y-2">
              <Label>{t('notificationPrefs.email.severityFilter')}</Label>
              <SeverityCheckboxGroup control={form.control} name="email.severityFilter" />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Webhook Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('notificationPrefs.webhook.title')}</CardTitle>
            <Controller
              control={form.control}
              name="webhook.enabled"
              render={({ field }) => (
                <Switch
                  id="webhook-enabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </CardHeader>
        {webhookEnabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('notificationPrefs.webhook.severityFilter')}</Label>
              <SeverityCheckboxGroup control={form.control} name="webhook.severityFilter" />
            </div>
            <p className="text-xs text-muted-foreground">{t('notificationPrefs.webhook.note')}</p>
          </CardContent>
        )}
      </Card>

      <SubmitButton isSubmitting={saveMutation.isPending}>
        {t('notificationPrefs.save')}
      </SubmitButton>
    </form>
  );
}

function SeverityCheckboxGroup({
  control,
  name,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: string;
}) {
  const t = useTranslations('alerts');

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex gap-4">
          {ALERT_SEVERITIES.map((s) => {
            const checked = (field.value as AlertSeverity[]).includes(s);
            return (
              <label key={s} className="flex items-center gap-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    const current = field.value as AlertSeverity[];
                    if (c) {
                      field.onChange([...current, s]);
                    } else {
                      field.onChange(current.filter((v: string) => v !== s));
                    }
                  }}
                />
                <span className="text-sm">{t(`severity.${SEVERITY_I18N[s]}` as never)}</span>
              </label>
            );
          })}
        </div>
      )}
    />
  );
}
