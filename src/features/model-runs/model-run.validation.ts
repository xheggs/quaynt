import { z } from 'zod';

/**
 * Client-side form validation schema for the "New Run" dialog.
 * Mirrors the server-side schema in app/api/v1/model-runs/route.ts.
 *
 * Validation error messages are i18n key strings — they are resolved
 * at render time via `t(error.message)` in FormMessage components.
 */
export const createModelRunFormSchema = z.object({
  promptSetId: z.string().min(1, { message: 'validation.promptSetRequired' }),
  brandId: z.string().min(1, { message: 'validation.brandRequired' }),
  adapterConfigIds: z
    .array(z.string().min(1))
    .min(1, { message: 'validation.adapterRequired' })
    .max(10, { message: 'validation.tooManyAdapters' }),
  locale: z.string().max(35).optional().or(z.literal('')),
  market: z.string().max(255).optional().or(z.literal('')),
});

export type CreateModelRunFormValues = z.infer<typeof createModelRunFormSchema>;
