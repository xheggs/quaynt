'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { getOnboarding, patchOnboarding } from '../api/onboarding';
import type { OnboardingResponse, UpdateOnboardingInput } from '../types';

const ONBOARDING_KEY = queryKeys.onboarding.detail('current');

export function useOnboarding() {
  return useQuery<OnboardingResponse>({
    queryKey: ONBOARDING_KEY,
    queryFn: getOnboarding,
    staleTime: 30_000,
  });
}

export function useUpdateOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOnboardingInput) => patchOnboarding(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ONBOARDING_KEY });
      const previous = queryClient.getQueryData<OnboardingResponse>(ONBOARDING_KEY);

      if (previous) {
        const next: OnboardingResponse = {
          ...previous,
          step: input.step ?? previous.step,
          roleHint: input.roleHint !== undefined ? input.roleHint : previous.roleHint,
          dismissedAt: input.dismissedAt !== undefined ? input.dismissedAt : previous.dismissedAt,
          milestones: {
            ...previous.milestones,
            ...(input.milestones ?? {}),
          },
        };
        queryClient.setQueryData(ONBOARDING_KEY, next);
      }

      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(ONBOARDING_KEY, ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ONBOARDING_KEY });
    },
  });
}
