import { suggestedCompetitorsJsonSchema, suggestedPromptsJsonSchema } from './schemas';
import type { SuggestionPrompt } from './types';

export type CompetitorPromptInput = {
  brandName: string;
  description: string | null;
  categories: string[];
  domain: string;
  /** roleHint as captured in 5.14 onboarding (e.g. `seo`, `marketing`, `founder`). */
  roleHint: string | null;
};

export type PromptGenerationInput = CompetitorPromptInput;

const SYSTEM_PRELUDE = `You are an analyst helping a marketing/SEO operator set up a brand
visibility tracker. Your suggestions populate a setup wizard — they are
*defaults the operator will edit*, not authoritative answers. Be precise,
avoid speculation, and keep all output in the requested JSON shape.`;

export function buildCompetitorPrompt(input: CompetitorPromptInput): SuggestionPrompt {
  return {
    system: SYSTEM_PRELUDE,
    user: [
      `Brand name: ${input.brandName}`,
      `Brand domain: ${input.domain}`,
      `Brand description: ${input.description ?? '(none provided)'}`,
      `Inferred categories: ${input.categories.join(', ') || '(unknown)'}`,
      `Operator role hint: ${input.roleHint ?? '(unknown)'}`,
      '',
      'Task: list up to 5 plausible competitors. For each, include:',
      '- name (the brand the operator would recognize)',
      '- domain (best-known public domain, or null if you are not confident)',
      '- reason (one short sentence — why this is a competitor)',
      '',
      'Rules:',
      '- Only include companies that compete on the same buyer or use case.',
      '- Prefer well-known competitors over obscure ones.',
      '- Do NOT include the brand itself.',
      '- If you are unsure, return fewer items rather than guessing.',
      '',
      'Respond with EXACTLY this JSON shape (an object whose only key is',
      '"competitors", containing an array). No prose, no markdown fences.',
      '{',
      '  "competitors": [',
      '    { "name": "Example", "domain": "example.com", "reason": "..." }',
      '  ]',
      '}',
    ].join('\n'),
    schemaName: 'SuggestedCompetitors',
    schemaDescription: 'A short list of plausible competitor brands.',
    jsonSchema: suggestedCompetitorsJsonSchema as unknown as Record<string, unknown>,
  };
}

export function buildPromptGenerationPrompt(input: PromptGenerationInput): SuggestionPrompt {
  return {
    system: SYSTEM_PRELUDE,
    user: [
      `Brand name: ${input.brandName}`,
      `Brand description: ${input.description ?? '(none provided)'}`,
      `Inferred categories: ${input.categories.join(', ') || '(unknown)'}`,
      `Operator role hint: ${input.roleHint ?? '(unknown)'}`,
      '',
      'Task: produce ~12 natural-language search prompts that a real buyer of this',
      'category might type into ChatGPT, Perplexity, Gemini, or Claude. The goal is',
      'to detect when AI engines mention this brand or its competitors.',
      '',
      'Rules:',
      '- Prompts should sound like a buyer doing real research, not marketing copy.',
      '- Avoid the brand name in the prompt — these are queries that *should*',
      '  surface the brand if AI engines know about it.',
      '- Mix discovery ("best X for Y"), comparison ("X vs Y for Z"), and',
      '  use-case ("how do I do Z") shapes.',
      '- Use {{brand}} as a placeholder *only* when a comparison genuinely needs',
      '  the brand interpolated; most prompts should not include {{brand}}.',
      '- Set tag to one of: discovery, comparison, use_case, problem.',
      '',
      'Respond with EXACTLY this JSON shape (an object whose only key is',
      '"prompts", containing an array). No prose, no markdown fences.',
      '{',
      '  "prompts": [',
      '    { "text": "best CRM for solo founders", "tag": "discovery" }',
      '  ]',
      '}',
    ].join('\n'),
    schemaName: 'SuggestedPrompts',
    schemaDescription: 'A list of ~12 natural-language search prompts.',
    jsonSchema: suggestedPromptsJsonSchema as unknown as Record<string, unknown>,
  };
}
