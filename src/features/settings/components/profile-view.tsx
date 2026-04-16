'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';

import { authClient } from '@/modules/auth/auth.client';
import { queryKeys } from '@/lib/query/keys';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useDelayedLoading } from '@/hooks/use-delayed-loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SubmitButton } from '@/components/forms/submit-button';
import { ErrorState } from '@/components/error-state';
import { ProfileSkeleton } from './settings-skeleton';

import { updateUserPreferences } from '../settings.api';
import { useUserPreferencesQuery } from '../use-settings-query';
import { profileUpdateSchema, type ProfileFormValues } from '../settings.validation';
import { SUPPORTED_LOCALES } from '../settings.types';

export function ProfileView() {
  const t = useTranslations('settings');
  const session = authClient.useSession();
  const preferencesQuery = useUserPreferencesQuery();

  const isLoading = session.isPending || preferencesQuery.isLoading;
  const { showSkeleton } = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return <ProfileSkeleton />;
  }

  if (preferencesQuery.isError) {
    return <ErrorState variant="section" onRetry={() => preferencesQuery.refetch()} />;
  }

  const user = session.data?.user;
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-page">{t('profile.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('profile.description')}</p>
      </div>

      <ProfileForm
        userName={user.name}
        userEmail={user.email}
        currentLocale={preferencesQuery.data?.locale ?? 'en'}
      />
    </div>
  );
}

interface ProfileFormProps {
  userName: string;
  userEmail: string;
  currentLocale: string;
}

function ProfileForm({ userName, userEmail, currentLocale }: ProfileFormProps) {
  const t = useTranslations('settings');
  const [locale, setLocale] = useState(currentLocale);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: userName,
    },
  });

  const profileMutation = useApiMutation<unknown, { name: string; locale?: string | null }>({
    mutationFn: async (data) => {
      const results = await Promise.all([
        authClient.updateUser({ name: data.name }),
        updateUserPreferences({ locale: data.locale }),
      ]);
      return results;
    },
    invalidateKeys: [queryKeys.userPreferences.all],
    successMessage: t('profile.saved'),
  });

  const onSubmit = (data: ProfileFormValues) => {
    profileMutation.mutate({
      name: data.name,
      locale: locale !== currentLocale ? locale : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.title')}</CardTitle>
        <CardDescription>{t('profile.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('profile.nameLabel')}</Label>
            <Input
              id="name"
              placeholder={t('profile.namePlaceholder')}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {t(form.formState.errors.name.message as never)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('profile.emailLabel')}</Label>
            <Input id="email" value={userEmail} disabled readOnly />
            <p className="text-xs text-muted-foreground">{t('profile.emailHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locale">{t('profile.localeLabel')}</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc === 'en' ? 'English' : loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('profile.localeHelp')}</p>
          </div>

          <SubmitButton isSubmitting={profileMutation.isPending}>{t('profile.save')}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
