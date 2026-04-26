import { z } from 'zod';

export const suggestedCompetitorsSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        domain: z.string().max(255).nullable().optional(),
        reason: z.string().max(280).nullable().optional(),
      })
    )
    .max(8),
});

export type SuggestedCompetitorsResponse = z.infer<typeof suggestedCompetitorsSchema>;

export const suggestedPromptsSchema = z.object({
  prompts: z
    .array(
      z.object({
        text: z.string().min(5).max(280),
        tag: z.string().max(40).nullable().optional(),
      })
    )
    .min(1)
    .max(20),
});

export type SuggestedPromptsResponse = z.infer<typeof suggestedPromptsSchema>;

/**
 * Hand-written JSON Schemas mirroring the Zod definitions above.
 * Providers that support strict structured output (OpenAI Responses API,
 * Anthropic tool-use input_schema) accept the JSON Schema form directly.
 */
export const suggestedCompetitorsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    competitors: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          domain: { type: ['string', 'null'], maxLength: 255 },
          reason: { type: ['string', 'null'], maxLength: 280 },
        },
        required: ['name', 'domain', 'reason'],
      },
    },
  },
  required: ['competitors'],
} as const;

export const suggestedPromptsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prompts: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', minLength: 5, maxLength: 280 },
          tag: { type: ['string', 'null'], maxLength: 40 },
        },
        required: ['text', 'tag'],
      },
    },
  },
  required: ['prompts'],
} as const;
