import { z } from 'zod';

export const ONBOARDING_STEPS = [
  'welcome',
  'brand',
  'competitors',
  'prompt_set',
  'first_run',
  'done',
] as const;

export const ONBOARDING_ROLE_HINTS = ['marketing', 'seo', 'founder', 'agency', 'other'] as const;

export type OnboardingRoleHint = (typeof ONBOARDING_ROLE_HINTS)[number];

/**
 * The PATCH input schema. `resultsViewed` is server-derived and read-only —
 * any client attempt to set it via `milestones.resultsViewed` is silently
 * ignored by validation here (the field is not on the schema).
 */
export const updateOnboardingSchema = z.object({
  step: z.enum(ONBOARDING_STEPS).optional(),
  roleHint: z.enum(ONBOARDING_ROLE_HINTS).nullable().optional(),
  milestones: z
    .object({
      brandAdded: z.boolean().optional(),
      competitorsAdded: z.boolean().optional(),
      promptSetSelected: z.boolean().optional(),
      firstRunTriggered: z.boolean().optional(),
      firstCitationSeen: z.boolean().optional(),
      tourCompleted: z.boolean().optional(),
    })
    .optional(),
  dismissedAt: z.string().datetime().nullable().optional(),
});

export type UpdateOnboardingInput = z.infer<typeof updateOnboardingSchema>;

export type OnboardingResponse = {
  workspaceId: string;
  step: (typeof ONBOARDING_STEPS)[number];
  roleHint: OnboardingRoleHint | null;
  milestones: {
    brandAdded: boolean;
    competitorsAdded: boolean;
    promptSetSelected: boolean;
    firstRunTriggered: boolean;
    firstCitationSeen: boolean;
    tourCompleted: boolean;
    /** Server-derived. Read-only. */
    resultsViewed: boolean;
  };
  completedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
