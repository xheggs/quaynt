import { z } from 'zod';

/**
 * Client-side prompt set form validation schema.
 * Mirrors the server-side schema in app/api/v1/prompt-sets/route.ts.
 *
 * Validation error messages are i18n key strings — they are resolved
 * at render time via `t(error.message)` in FormMessage components.
 */
export const promptSetFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
  description: z
    .string()
    .max(2000, { message: 'validation.descriptionTooLong' })
    .optional()
    .or(z.literal('')),
  tags: z
    .array(z.string().max(100, { message: 'validation.tagTooLong' }))
    .max(20, { message: 'validation.tooManyTags' }),
});

export type PromptSetFormValues = z.infer<typeof promptSetFormSchema>;

/**
 * Client-side prompt template validation schema.
 * Mirrors the server-side schema in app/api/v1/prompt-sets/[promptSetId]/prompts/route.ts.
 */
export const promptFormSchema = z.object({
  template: z
    .string()
    .min(1, { message: 'validation.templateRequired' })
    .max(5000, { message: 'validation.templateTooLong' }),
});

export type PromptFormValues = z.infer<typeof promptFormSchema>;
