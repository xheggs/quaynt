import { apiFetch } from '@/lib/query/fetch';
import type { OnboardingResponse, UpdateOnboardingInput } from '../types';

export function getOnboarding(): Promise<OnboardingResponse> {
  return apiFetch<OnboardingResponse>('/onboarding');
}

export function patchOnboarding(input: UpdateOnboardingInput): Promise<OnboardingResponse> {
  return apiFetch<OnboardingResponse>('/onboarding', {
    method: 'PATCH',
    body: input,
  });
}
