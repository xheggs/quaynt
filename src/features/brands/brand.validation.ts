import { z } from 'zod';

/**
 * Client-side brand form validation schema.
 * Mirrors the server-side schema in app/api/v1/brands/route.ts.
 *
 * Validation error messages are i18n key strings — they are resolved
 * at render time via `t(error.message)` in FormMessage components.
 */
export const brandFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
  domain: z.string().max(255, { message: 'validation.domainTooLong' }).optional().or(z.literal('')),
  aliases: z
    .array(z.string().max(255, { message: 'validation.aliasTooLong' }))
    .max(50, { message: 'validation.tooManyAliases' }),
  description: z
    .string()
    .max(1000, { message: 'validation.descriptionTooLong' })
    .optional()
    .or(z.literal('')),
});

export type BrandFormValues = z.infer<typeof brandFormSchema>;
