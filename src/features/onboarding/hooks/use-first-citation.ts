'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { fetchCitations } from '@/features/citations/citation.api';
import type { CitationRecord } from '@/features/citations/citation.types';
import { useUpdateOnboarding, useOnboarding } from './use-onboarding';

interface Options {
  /** Limit to a specific run; omit to look across the workspace's recent runs. */
  modelRunId?: string;
  /**
   * Skip the watcher entirely (e.g. when onboarding is dismissed). The hook
   * still returns null/undefined so the call site can render unconditionally.
   */
  enabled?: boolean;
}

/**
 * Watches for the first earned citation and persists `firstCitationSeen=true`
 * the first time one appears. The PATCH is the dedup boundary — once
 * persistence flips, no subsequent poll triggers another transition.
 *
 * Returns `{ citation }` so the caller can render a wow card with the same
 * data the hook detected.
 */
export function useFirstCitation({ modelRunId, enabled = true }: Options = {}): {
  citation: CitationRecord | null;
} {
  const onboarding = useOnboarding();
  const update = useUpdateOnboarding();
  const alreadySeen = onboarding.data?.milestones.firstCitationSeen ?? false;

  const params: Record<string, unknown> = {
    citationType: 'earned',
    sort: 'createdAt',
    order: 'asc',
    limit: 1,
  };
  if (modelRunId) params.modelRunId = modelRunId;

  const { data } = useQuery({
    queryKey: queryKeys.citations.list(params),
    queryFn: () => fetchCitations(params),
    enabled: enabled && !alreadySeen,
  });

  const citation = data?.data?.[0] ?? null;

  useEffect(() => {
    if (!enabled || alreadySeen || !citation || update.isPending) return;
    update.mutate({ milestones: { firstCitationSeen: true } });
  }, [enabled, alreadySeen, citation, update]);

  return { citation };
}
