'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useUpdateOnboarding } from '@/features/onboarding';

type Props = {
  label: string;
};

export function SkipOnboardingButton({ label }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const update = useUpdateOnboarding();

  // The welcome step is the editorial commitment moment — keep the chrome
  // quiet there. The manual fallback link inside the form still gives users
  // a way out without putting an exit ramp in the global header.
  const isWelcomeStep = pathname?.endsWith('/onboarding/welcome');
  if (isWelcomeStep) return null;

  const handleClick = () => {
    update.mutate(
      { dismissedAt: new Date().toISOString() },
      {
        onSuccess: () => router.push(`/${locale}/dashboard`),
      }
    );
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={update.isPending}
    >
      {label}
    </Button>
  );
}
