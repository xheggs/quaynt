'use client';

import { useLocale } from 'next-intl';
import { useFirstCitation } from '@/features/onboarding/hooks/use-first-citation';
import { useOnboarding, useUpdateOnboarding } from '@/features/onboarding/hooks/use-onboarding';
import { WowCard } from '@/features/onboarding/components/wow-card';

/**
 * Dashboard-side wow card host. Renders the celebration card the first time
 * a workspace's onboarding has triggered a run AND that run has produced an
 * earned citation, but the user has not yet acknowledged it.
 *
 * The card disappears after dismiss / "View full results" click via a PATCH
 * to `firstCitationSeen=true`. Subsequent dashboard loads skip the host
 * entirely.
 */
export function DashboardWowHost() {
  const locale = useLocale();
  const onboarding = useOnboarding();
  const update = useUpdateOnboarding();

  const firstRunTriggered = onboarding.data?.milestones.firstRunTriggered ?? false;
  const firstCitationSeen = onboarding.data?.milestones.firstCitationSeen ?? false;
  const enabled = firstRunTriggered && !firstCitationSeen;

  const { citation } = useFirstCitation({ enabled });

  if (!enabled || !citation) return null;

  return (
    <WowCard
      citation={citation}
      onDismiss={() => update.mutate({ milestones: { firstCitationSeen: true } })}
      viewAllHref={`/${locale}/citations`}
    />
  );
}
