import { z } from 'zod';

/**
 * Client-side settings form validation schemas.
 *
 * Validation error messages are i18n key strings — they are resolved
 * at render time via `t(error.message)` in FormMessage components.
 */

export const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
});

export type ProfileFormValues = z.infer<typeof profileUpdateSchema>;

export const localePreferenceSchema = z.object({
  locale: z.string().max(10),
});

export type LocalePreferenceFormValues = z.infer<typeof localePreferenceSchema>;

export const workspaceUpdateSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
});

export type WorkspaceFormValues = z.infer<typeof workspaceUpdateSchema>;

export const addMemberSchema = z.object({
  email: z.string().email({ message: 'validation.emailInvalid' }),
  role: z.enum(['admin', 'member'], { message: 'validation.roleRequired' }),
});

export type AddMemberFormValues = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member'], { message: 'validation.roleRequired' }),
});

export type UpdateMemberRoleFormValues = z.infer<typeof updateMemberRoleSchema>;
