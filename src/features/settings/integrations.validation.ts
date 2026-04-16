import { z } from 'zod';
import type { CredentialField, ConfigField } from './integrations.types';

/**
 * Client-side integration form validation schemas.
 *
 * Validation error messages are i18n key strings — they are resolved
 * at render time via `t(error.message)` in FormMessage components.
 */

export const adapterCreateSchema = z.object({
  platformId: z.string().min(1, { message: 'validation.platformRequired' }),
  displayName: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
});

export type AdapterCreateFormValues = z.infer<typeof adapterCreateSchema>;

export const adapterUpdateSchema = z.object({
  displayName: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' })
    .optional(),
  enabled: z.boolean().optional(),
});

export type AdapterUpdateFormValues = z.infer<typeof adapterUpdateSchema>;

export const apiKeyCreateSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'validation.nameRequired' })
    .max(255, { message: 'validation.nameTooLong' }),
  scope: z.enum(['read', 'read-write', 'admin'], {
    message: 'validation.scopeRequired',
  }),
  expiresAt: z.string().datetime().optional().or(z.literal('')),
});

export type ApiKeyCreateFormValues = z.infer<typeof apiKeyCreateSchema>;

export const webhookCreateSchema = z.object({
  url: z
    .string()
    .url({ message: 'validation.urlInvalid' })
    .refine((val) => val.startsWith('https://'), {
      message: 'validation.urlHttpsRequired',
    }),
  events: z.array(z.string()).min(1, { message: 'validation.eventsRequired' }),
  description: z
    .string()
    .max(500, { message: 'validation.descriptionTooLong' })
    .optional()
    .or(z.literal('')),
});

export type WebhookCreateFormValues = z.infer<typeof webhookCreateSchema>;

export const webhookUpdateSchema = z.object({
  url: z
    .string()
    .url({ message: 'validation.urlInvalid' })
    .refine((val) => val.startsWith('https://'), {
      message: 'validation.urlHttpsRequired',
    })
    .optional(),
  events: z.array(z.string()).min(1, { message: 'validation.eventsRequired' }).optional(),
  description: z
    .string()
    .max(500, { message: 'validation.descriptionTooLong' })
    .optional()
    .nullable(),
  enabled: z.boolean().optional(),
});

export type WebhookUpdateFormValues = z.infer<typeof webhookUpdateSchema>;

/**
 * Dynamically builds a Zod schema from a platform's credential field definitions.
 * Each field's requirement and type constraints are applied based on the schema.
 */
export function buildCredentialSchema(
  fields: CredentialField[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;

    if (field.type === 'number') {
      fieldSchema = z.coerce.number({
        message: 'validation.numberRequired',
      });
    } else {
      fieldSchema = z.string();
    }

    if (field.required) {
      if (field.type !== 'number') {
        fieldSchema = (fieldSchema as z.ZodString).min(1, {
          message: 'validation.fieldRequired',
        });
      }
    } else {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.key] = fieldSchema;
  }

  return z.object(shape);
}

/**
 * Dynamically builds a Zod schema from a platform's config field definitions.
 * Handles text, number, and select types with appropriate constraints.
 */
export function buildConfigSchema(
  fields: ConfigField[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;

    if (field.type === 'number') {
      let numSchema = z.coerce.number({
        message: 'validation.numberRequired',
      });
      if (field.min !== undefined) {
        numSchema = numSchema.min(field.min, {
          message: 'validation.numberMin',
        });
      }
      if (field.max !== undefined) {
        numSchema = numSchema.max(field.max, {
          message: 'validation.numberMax',
        });
      }
      fieldSchema = numSchema;
    } else if (field.type === 'select' && field.options?.length) {
      fieldSchema = z.enum(field.options as [string, ...string[]], {
        message: 'validation.selectRequired',
      });
    } else {
      fieldSchema = z.string();
    }

    if (field.required) {
      if (field.type === 'text') {
        fieldSchema = (fieldSchema as z.ZodString).min(1, {
          message: 'validation.fieldRequired',
        });
      }
    } else {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.key] = fieldSchema;
  }

  return z.object(shape);
}
