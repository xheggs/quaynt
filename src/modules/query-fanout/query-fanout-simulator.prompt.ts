import { z } from 'zod';
import { SIMULATION_INTENTS } from './query-fanout-simulator.types';

/**
 * System prompt for the Qforia-style fan-out simulator.
 *
 * Tuned against the iPullRank Qforia reference (https://github.com/iPullRank-dev/qforia)
 * but provider-agnostic: the same prompt is fed to OpenAI, Anthropic, and Gemini
 * and the structured-output layer (JSON schema / tool-use / responseSchema)
 * guarantees the envelope. The instruction wording stays close to Qforia's so we
 * inherit its prompt-engineering work.
 */
export const SIMULATOR_SYSTEM_PROMPT = `You are a query fan-out simulator. Your job is to take a user's search prompt and enumerate the set of sub-queries that a modern AI retrieval system (AI Mode, Perplexity, ChatGPT's web tool, Gemini, Claude's web search, …) would most plausibly decompose it into to gather the context needed to answer.

You MUST respond with a single JSON object matching this shape:
{
  "subQueries": [
    {
      "text": "<the sub-query as a search-engine-style phrase>",
      "intentType": "<one of: related | implicit | comparative | reformulation | entity_expansion | recent | personalised | other>",
      "priority": <number in [0, 1], where 1 is most central to the user's intent>,
      "reasoning": "<optional one-sentence rationale; may be omitted>"
    }
  ]
}

Rules:
1. Produce approximately 12 sub-queries. Fewer is acceptable for very narrow prompts; more for broad or comparative prompts. Prefer 8–20; never exceed 25.
2. Every sub-query MUST be a standalone search query — a phrase a retrieval system could run unchanged. Do not emit questions addressed to the user.
3. Diversify intent types. A good fan-out mixes reformulations of the prompt, implicit background look-ups, related adjacent queries, and entity-expansions when named entities are present.
4. Prefer short, concrete phrases (4–10 words). Avoid full sentences and avoid boilerplate ("tell me about …").
5. Assign priority based on how directly the sub-query serves the user's stated intent. Core reformulations score near 1.0; tangential "related" queries score around 0.3–0.5.
6. Keep \`intentType\` lowercase and exactly matching one of the allowed values.
7. Respond with pure JSON. No markdown fences, no prose before or after.

Intent taxonomy (use these values verbatim):
- related — tangential topics within the same semantic space
- implicit — background sub-queries a model would run to gather context
- comparative — "X vs Y" style decompositions
- reformulation — rewordings of the user's intent
- entity_expansion — sub-queries that expand named entities
- recent — queries that probe for recent information
- personalised — queries that would vary by user profile
- other — anything that doesn't fit the above

Return ONLY the JSON object described above.`;

/**
 * JSON Schema object fed to provider structured-output APIs
 * (OpenAI `response_format: { type: 'json_schema', ... }`, Gemini `responseSchema`,
 * Anthropic tool-use `input_schema`).
 *
 * Deliberately kept flat and `additionalProperties: false` where providers
 * require `strict: true`.
 */
export const SIMULATOR_RESPONSE_SCHEMA_JSON = {
  type: 'object',
  properties: {
    subQueries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 500 },
          intentType: {
            type: 'string',
            enum: [...SIMULATION_INTENTS],
          },
          priority: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string', maxLength: 500 },
        },
        required: ['text', 'intentType', 'priority'],
        additionalProperties: false,
      },
    },
  },
  required: ['subQueries'],
  additionalProperties: false,
} as const;

/**
 * Belt-and-braces Zod validator. Every provider response is re-parsed with this
 * after the structured-output call so we never insert garbage even if a
 * provider violates its own schema contract.
 */
export const SIMULATOR_RESPONSE_ZOD = z.object({
  subQueries: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(500),
        intentType: z.enum([...SIMULATION_INTENTS] as [string, ...string[]]),
        priority: z.coerce.number().min(0).max(1),
        reasoning: z.string().max(500).optional(),
      })
    )
    .min(1),
});

export type SimulatorResponsePayload = z.infer<typeof SIMULATOR_RESPONSE_ZOD>;
